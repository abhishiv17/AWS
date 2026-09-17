import assert from "node:assert/strict";
import {
  buildSimulationSnapshot,
  createInitialSimulationState,
  createLiveScenario,
  startSimulation,
} from "../app/simulation/core";
import { EventsNet } from "../app/simulation/net/eventsNet";
import type {
  ClientIntent,
  DrillRoom,
  EvidenceRecord,
  Participant,
  RouteMessage,
} from "../app/simulation/net/types";
import type { SimulationSnapshot } from "../app/simulation/core/report";
import {
  acknowledgeRouteMessage,
  appendTelemetryEvent,
  telemetryDelta,
  type TelemetryEvent,
} from "../app/simulation/net/telemetry";

console.log("----------------------------------------");
console.log("Running Guide / Overwatch Telemetry Tests");
console.log("----------------------------------------\n");

const guide: Participant = {
  id: "guide-1",
  name: "Guide",
  role: "warden",
  sectorId: "sec",
  joinedAt: 0,
};
const navigator: Participant = {
  id: "navigator-1",
  name: "Navigator",
  role: "evacuee",
  sectorId: null,
  joinedAt: 0,
};
const room: DrillRoom = {
  drillId: "drill-overwatch",
  code: "OVRWT",
  hostId: navigator.id,
  maxPlayers: 2,
  phase: "active",
  startsAt: null,
  participants: [navigator, guide],
  createdAt: 0,
  scenarioVersion: "compact-live-v1",
  seed: 7,
  outcome: null,
};

console.log("Test 1: Verifying monotonic telemetry envelopes and cursor deltas...");
const context = {
  drillId: room.drillId,
  runId: "run-overwatch",
  tick: 12,
  at: 1000,
  actorId: guide.id,
  actorKind: "guide" as const,
};
let telemetry: TelemetryEvent[] = [];
let nextSequence = 1;
let appended = appendTelemetryEvent(telemetry, nextSequence, context, {
  type: "GUIDE_WARNING_SENT",
  messageId: "drill-overwatch:message:1",
  direction: "west",
  targetSector: "lobby",
  confidence: "verified",
});
telemetry = appended.events;
nextSequence = appended.nextSequence;
appended = appendTelemetryEvent(telemetry, nextSequence, {
  ...context,
  tick: 13,
  at: 1100,
  actorId: navigator.id,
  actorKind: "navigator",
}, {
  type: "GUIDE_WARNING_ACKNOWLEDGED",
  messageId: "drill-overwatch:message:1",
  acknowledgedAt: 1100,
});
telemetry = appended.events;
assert.deepEqual(telemetry.map((event) => event.sequence), [1, 2]);
assert(telemetry[1]!.tick >= telemetry[0]!.tick);
assert.equal(telemetry[0]!.actorId, guide.id);
assert.equal(telemetry[1]!.actorId, navigator.id);
assert.equal(telemetry[1]!.messageId, "drill-overwatch:message:1");
assert.deepEqual(telemetryDelta(telemetry, 0).events, telemetry);
assert.deepEqual(telemetryDelta(telemetry, 1).events, [telemetry[1]]);
assert.deepEqual(telemetryDelta(telemetry, 2).events, []);
console.log("✓ Telemetry preserves sequence, tick, actor metadata, and cursor deltas.");

console.log("\nTest 2: Verifying route acknowledgement is ordered and idempotent...");
const routeMessage: RouteMessage = {
  messageId: "drill-overwatch:message:1",
  drillId: room.drillId,
  senderId: guide.id,
  senderSector: "sec",
  targetSector: "lobby",
  direction: "west",
  kind: "route",
  confidence: "verified",
  urgency: "urgent",
  createdAt: 900,
  expiresAt: 5000,
  caption: "Proceed to the verified west route.",
  acknowledgedAt: null,
};
const firstAcknowledgement = acknowledgeRouteMessage(routeMessage, routeMessage.messageId, 1200);
assert(firstAcknowledgement.changed);
assert.equal(firstAcknowledgement.message?.acknowledgedAt, 1200);
const duplicateAcknowledgement = acknowledgeRouteMessage(firstAcknowledgement.message, routeMessage.messageId, 1300);
assert.equal(duplicateAcknowledgement.changed, false);
assert.equal(duplicateAcknowledgement.message?.acknowledgedAt, 1200);
console.log("✓ The Navigator acknowledges the route message once; duplicate Q presses are harmless.");

console.log("\nTest 3: Verifying authority ordering and canonical event emission...");
const net = new EventsNet();
const published: unknown[] = [];
type Authority = {
  evidence: EvidenceRecord[];
  latestMessage: RouteMessage | null;
  telemetryEvents: TelemetryEvent[];
  telemetryDelivered: Record<string, number>;
  telemetryNextSequence: number;
  coreSnapshot: SimulationSnapshot | null;
};
type InternalNet = {
  room: DrillRoom | null;
  code: string;
  myId: string;
  socket: { publish: (...args: unknown[]) => void };
  drill: (room: DrillRoom) => Authority;
  authorize: (from: string, intent: Extract<ClientIntent, { type: "warden-command" | "observe-evidence" }>) => void;
  resumeTelemetryCursor: (from: string, cursor: number) => void;
};
const internal = net as unknown as InternalNet;
internal.room = room;
internal.code = room.code;
internal.myId = navigator.id;
internal.socket = { publish: (...args) => published.push(args) };
const authority = internal.drill(room);
authority.coreSnapshot = buildSimulationSnapshot(
  startSimulation(createInitialSimulationState(createLiveScenario(7), "run-overwatch")),
  createLiveScenario(7),
);

internal.authorize(guide.id, {
  type: "warden-command",
  command: "SEND_WEST_ROUTE",
  evidenceId: "east-route-evidence",
  clientSentAt: 1,
  idempotencyKey: "out-of-order-send",
});
assert.equal(authority.evidence.find((item) => item.id === "east-route-evidence")?.status, "UNKNOWN");
assert.equal(authority.telemetryEvents.length, 0);

internal.authorize(guide.id, {
  type: "observe-evidence",
  evidenceId: "east-route-evidence",
  clientSentAt: 2,
});
internal.authorize(guide.id, {
  type: "warden-command",
  command: "VERIFY_EAST_ROUTE",
  evidenceId: "east-route-evidence",
  clientSentAt: 3,
  idempotencyKey: "verify-route",
});
internal.authorize(guide.id, {
  type: "warden-command",
  command: "SEND_WEST_ROUTE",
  evidenceId: "east-route-evidence",
  clientSentAt: 4,
  idempotencyKey: "send-route",
});
assert.equal(authority.telemetryEvents[0]?.type, "GUIDE_WARNING_SENT");
const sentMessageId = authority.latestMessage?.messageId;
assert(sentMessageId);

net.send({
  type: "route-message-ack",
  messageId: sentMessageId,
  clientSentAt: 5,
  idempotencyKey: "ack-route",
});
net.send({
  type: "route-message-ack",
  messageId: sentMessageId,
  clientSentAt: 6,
  idempotencyKey: "ack-route-duplicate",
});
const acknowledgements = authority.telemetryEvents.filter((event) => event.type === "GUIDE_WARNING_ACKNOWLEDGED");
assert.equal(acknowledgements.length, 1);
assert.equal(acknowledgements[0]?.messageId, sentMessageId);
assert.equal(authority.latestMessage?.acknowledgedAt !== null, true);

internal.authorize(guide.id, {
  type: "warden-command",
  command: "PEER_ASSIST_MAYA",
  clientSentAt: 7,
  idempotencyKey: "maya-assist",
});
assert.equal(authority.latestMessage?.kind, "assistance");
const mayaMessageId = authority.latestMessage?.messageId;
assert(mayaMessageId);
assert.equal(authority.telemetryEvents.filter((event) => event.type === "MAYA_ASSISTANCE_REQUESTED").length, 1);
assert.equal(authority.coreSnapshot?.occupants.maya.status, "waiting");
net.send({
  type: "route-message-ack",
  messageId: mayaMessageId,
  clientSentAt: 8,
  idempotencyKey: "maya-assist-ack",
});
assert.equal(authority.telemetryEvents.filter((event) => event.type === "MAYA_ASSISTANCE_ACKNOWLEDGED").length, 1);
assert.equal(authority.coreSnapshot?.occupants.maya.status, "waiting");

internal.authorize(guide.id, {
  type: "warden-command",
  command: "APPLY_VENTILATION",
  evidenceId: "east-route-evidence",
  clientSentAt: 9,
  idempotencyKey: "apply-ventilation",
});
internal.authorize(guide.id, {
  type: "warden-command",
  command: "APPLY_VENTILATION",
  evidenceId: "east-route-evidence",
  clientSentAt: 10,
  idempotencyKey: "apply-ventilation-duplicate",
});
assert.equal(authority.telemetryEvents.filter((event) => event.type === "VENTILATION_ACTIVATED").length, 1);
assert.deepEqual(authority.telemetryEvents.map((event) => event.sequence), [1, 2, 3, 4, 5]);
assert(published.some((entry) => JSON.stringify(entry).includes("telemetry")));

published.length = 0;
internal.resumeTelemetryCursor(guide.id, 2);
const livePublish = published.find((entry) => Array.isArray(entry) && entry[0] === `/live/${room.code}/warden`);
assert(livePublish && Array.isArray(livePublish[1]));
const resumedState = (livePublish[1][0] as { state: { telemetry: { cursor: number; events: TelemetryEvent[] } } }).state;
assert.equal(resumedState.telemetry.cursor, 5);
assert.deepEqual(resumedState.telemetry.events.map((event) => event.sequence), [3, 4, 5]);
assert.equal(authority.telemetryDelivered[guide.id], 5);
console.log("✓ Observe/verify/send ordering, idempotent commands, and reconnect cursor replay are authoritative.");

console.log("\n========================================");
console.log("All Guide / Overwatch telemetry tests passed cleanly!");
console.log("========================================");
