import fs from "node:fs";
import type { NetEvent, DrillRoom } from "../app/simulation/net/types";
import type { TelemetryDetails } from "../app/simulation/net/telemetry";
import type { EventsNet as EventsNetInstance } from "../app/simulation/net/eventsNet";

async function main() {
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
for (const key of ["NEXT_PUBLIC_EVENTS_HTTP_HOST", "NEXT_PUBLIC_EVENTS_REALTIME_URL", "NEXT_PUBLIC_EVENTS_API_KEY"]) {
  if (!env[key]) throw new Error(`${key} is missing from .env.local`);
  process.env[key] = env[key];
}
if (typeof WebSocket !== "function") throw new Error("Node WebSocket is unavailable");

const [{ EventsNet }, { useSimulation }] = await Promise.all([
  import("../app/simulation/net/eventsNet"),
  import("../app/simulation/store"),
]);

const code = `RC${Date.now().toString(36).slice(-6).toUpperCase()}`;
const navigator = {
  id: "navigator-1",
  name: "Navigator",
  role: null,
  sectorId: null,
  joinedAt: Date.now(),
};
const guide = {
  id: "guide-1",
  name: "Guide",
  role: null,
  sectorId: null,
  joinedAt: Date.now(),
};
const seed: DrillRoom = {
  drillId: `drill-${code}`,
  code,
  hostId: "",
  maxPlayers: 2,
  phase: "lobby",
  startsAt: null,
  participants: [],
  createdAt: Date.now(),
  scenarioVersion: "compact-live-v1",
  seed: 7,
  outcome: null,
};

type InternalNet = {
  room: DrillRoom | null;
  socket: {
    ready: boolean;
    ws: { close: () => void } | null;
    reconnect: () => void;
  } | null;
  drill: (room: DrillRoom) => unknown;
  recordTelemetry: (
    drill: unknown,
    actorId: string,
    actorKind: "guide",
    details: TelemetryDetails,
  ) => void;
};

function waitForEvent(
  net: EventsNetInstance,
  predicate: (event: NetEvent) => boolean,
  timeoutMs = 10_000,
  label = "application event",
): Promise<NetEvent> {
  return new Promise((resolve, reject) => {
    let stop: () => void = () => undefined;
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);
    stop = net.onMessage((event) => {
      if (!predicate(event)) return;
      clearTimeout(timer);
      stop();
      resolve(event);
    });
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntil(predicate: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error("Timed out waiting for transport state");
}

const host = new EventsNet();
const warden = new EventsNet();
const checks: string[] = [];
let stopWardenState: () => void = () => undefined;

try {
  await host.connect(code);
  await host.createRoom(seed);
  const hostJoin = await host.join(code, navigator);
  if ("error" in hostJoin) throw new Error(`host join failed: ${hostJoin.error}`);

  await warden.connect(code);
  const wardenJoin = await warden.join(code, guide);
  if ("error" in wardenJoin) throw new Error(`warden join failed: ${wardenJoin.error}`);
  checks.push("lobby-admission");

  const activeHost = waitForEvent(host, (event) => event.type === "room" && event.room.phase === "active", 10_000, "host active room");
  const activeWarden = waitForEvent(warden, (event) => event.type === "room" && event.room.phase === "active", 10_000, "warden active room");
  const started = await host.start(code, navigator.id);
  if (!started.ok) throw new Error(`start failed: ${started.error}`);
  const [hostActive, wardenActive] = await Promise.all([activeHost, activeWarden]);
  if (hostActive.type !== "room" || wardenActive.type !== "room") throw new Error("active room event missing");
  if (hostActive.room.participants.find((item) => item.id === navigator.id)?.role !== "evacuee")
    throw new Error("deterministic evacuee role was not assigned to Navigator");
  if (wardenActive.room.participants.find((item) => item.id === guide.id)?.role !== "warden")
    throw new Error("deterministic warden role was not assigned to Guide");
  checks.push("active-role-assignment");

  stopWardenState = warden.onMessage((event: NetEvent) => {
    if (event.type === "warden-state") useSimulation.getState().applyWardenState(event.state);
  });

  const observed = waitForEvent(
    warden,
    (event) => event.type === "warden-state" && event.state.evidence.some((item) => item.id === "east-route-evidence" && item.status === "OBSERVED"),
    10_000,
    "observed evidence state",
  );
  warden.send({ type: "observe-evidence", evidenceId: "east-route-evidence", clientSentAt: Date.now() });
  await observed;
  warden.send({
    type: "warden-command",
    command: "VERIFY_EAST_ROUTE",
    evidenceId: "east-route-evidence",
    clientSentAt: Date.now(),
    idempotencyKey: "reconnect-verify",
  });
  await waitForEvent(
    warden,
    (event) => event.type === "warden-state" && event.state.evidence.some((item) => item.id === "east-route-evidence" && item.status === "VERIFIED"),
    10_000,
    "verified evidence state",
  );
  const firstTelemetry = waitForEvent(
    warden,
    (event) => event.type === "warden-state" && event.state.telemetry.events.some((item) => item.sequence === 1),
    10_000,
    "initial telemetry state",
  );
  warden.send({
    type: "warden-command",
    command: "SEND_WEST_ROUTE",
    evidenceId: "east-route-evidence",
    clientSentAt: Date.now(),
    idempotencyKey: "reconnect-route",
  });
  const firstState = await firstTelemetry;
  if (firstState.type !== "warden-state") throw new Error("initial telemetry state missing");
  if (useSimulation.getState().telemetryCursor !== 1) throw new Error("initial telemetry cursor was not consumed");
  checks.push("authority-telemetry");

  const wardenInternal = warden as unknown as InternalNet;
  const authorityInternal = host as unknown as InternalNet;
  if (!wardenInternal.socket?.ws) throw new Error("Warden socket is unavailable for reconnect test");
  const oldSocket = wardenInternal.socket.ws;
  wardenInternal.socket.ws = null;
  oldSocket.close();
  wardenInternal.socket.reconnect();
  await waitUntil(() => wardenInternal.socket?.ready === false, 2_000);

  const replayed = waitForEvent(
    warden,
    (event) => event.type === "warden-state" && event.state.telemetry.events.some((item) => item.sequence === 2),
    15_000,
    "replayed telemetry state",
  );
  const room = authorityInternal.room;
  if (!room) throw new Error("authority room disappeared during reconnect");
  const drill = authorityInternal.drill(room);
  authorityInternal.recordTelemetry(drill, guide.id, "guide", {
    type: "GUIDE_WARNING_ACKNOWLEDGED",
    messageId: "reconnect-missed-event",
    acknowledgedAt: Date.now(),
  });
  const replayedState = await replayed;
  if (replayedState.type !== "warden-state") throw new Error("replayed telemetry state missing");
  if (replayedState.state.telemetry.cursor !== 2) throw new Error("reconnect cursor did not advance to replayed event");
  if (replayedState.state.telemetry.events.map((item) => item.sequence).join(",") !== "2")
    throw new Error("reconnect replay contained duplicates or skipped events");
  checks.push("cursor-reconnect-replay");

  console.log(JSON.stringify({ ok: true, code, checks }));
} finally {
  stopWardenState();
  host.disconnect();
  warden.disconnect();
}
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
