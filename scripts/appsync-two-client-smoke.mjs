import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
const host = env.NEXT_PUBLIC_EVENTS_HTTP_HOST;
const realtimeUrl = env.NEXT_PUBLIC_EVENTS_REALTIME_URL;
const apiKey = env.NEXT_PUBLIC_EVENTS_API_KEY;
if (!host || !realtimeUrl || !apiKey) throw new Error("AppSync values are missing from .env.local");
if (typeof WebSocket !== "function") throw new Error("Node WebSocket is unavailable");

const authorization = { host, "x-api-key": apiKey };
const header = Buffer.from(JSON.stringify(authorization)).toString("base64url");
const code = `SM${Date.now().toString(36).slice(-6).toUpperCase()}`;
let operation = 0;

function nextId(prefix) {
  operation += 1;
  return `${prefix}-${operation}`;
}

class Probe {
  constructor(label) {
    this.label = label;
    this.inbox = [];
    this.waiters = [];
    this.ws = new WebSocket(realtimeUrl, ["aws-appsync-event-ws", `header-${header}`]);
    this.connected = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      this.ws.addEventListener("message", (event) => {
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.type === "connection_ack" && !settled) {
          settled = true;
          resolve(message);
        }
        this.dispatch(message);
      });
      this.ws.addEventListener("error", () => fail(new Error(`${label} websocket error`)));
      this.ws.addEventListener("close", () => {
        fail(new Error(`${label} websocket closed before connection_ack`));
        for (const waiter of this.waiters.splice(0)) waiter.reject(new Error(`${label} websocket closed`));
      });
    });
    this.ws.addEventListener("open", () => this.ws.send(JSON.stringify({ type: "connection_init" })));
  }

  dispatch(message) {
    const index = this.waiters.findIndex((waiter) => waiter.match(message));
    if (index >= 0) {
      const [waiter] = this.waiters.splice(index, 1);
      waiter.resolve(message);
    } else {
      this.inbox.push(message);
    }
  }

  waitFor(match, timeoutMs = 5000) {
    const queued = this.inbox.findIndex(match);
    if (queued >= 0) return Promise.resolve(this.inbox.splice(queued, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject,
      };
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error(`${this.label} timed out waiting for AppSync message`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  async subscribe(channel) {
    await this.connected;
    const id = nextId(`${this.label}-sub`);
    this.ws.send(JSON.stringify({ type: "subscribe", id, channel, authorization }));
    const response = await this.waitFor(
      (message) => (message.type === "subscribe_success" || message.type === "subscribe_error") && message.id === id,
    );
    if (response.type !== "subscribe_success") throw new Error(`${this.label} subscription failed`);
  }

  async publish(channel, payload) {
    await this.connected;
    const id = nextId(`${this.label}-pub`);
    this.ws.send(JSON.stringify({
      type: "publish",
      id,
      channel,
      events: [JSON.stringify(payload)],
      authorization,
    }));
    const response = await this.waitFor(
      (message) => (message.type === "publish_success" || message.type === "publish_error") && message.id === id,
    );
    if (response.type !== "publish_success") throw new Error(`${this.label} publish failed`);
  }

  async waitForData(predicate) {
    return this.waitFor((message) => {
      if (message.type !== "data") return false;
      const events = Array.isArray(message.event) ? message.event : [message.event];
      return events.some((event) => {
        try {
          return predicate(typeof event === "string" ? JSON.parse(event) : event);
        } catch {
          return false;
        }
      });
    });
  }

  close() {
    this.ws.close();
  }
}

const navigator = new Probe("navigator");
const guide = new Probe("guide");
const checks = [];
try {
  await Promise.all([navigator.connected, guide.connected]);
  checks.push("two-client-connect");
  await Promise.all([
    navigator.subscribe(`/game/${code}/*`),
    navigator.subscribe(`/live/${code}/warden`),
    guide.subscribe(`/game/${code}/*`),
    guide.subscribe(`/live/${code}/warden`),
  ]);
  checks.push("subscribe");

  await navigator.publish(`/game/${code}/room`, { t: "sync", from: "navigator", participant: { id: "navigator" } });
  await guide.waitForData((payload) => payload?.t === "sync" && payload.from === "navigator");
  checks.push("room-publish");

  await guide.publish(`/game/${code}/cmd`, { t: "telemetry-cursor", from: "guide", cursor: 0 });
  await navigator.waitForData((payload) => payload?.t === "telemetry-cursor" && payload.from === "guide" && payload.cursor === 0);
  checks.push("cursor-publish");

  console.log(JSON.stringify({ ok: true, code, checks }));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    code,
    checks,
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
} finally {
  navigator.close();
  guide.close();
}
