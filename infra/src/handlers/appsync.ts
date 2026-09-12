import type { AppSyncEvent, EvidenceRecord, RouteMessage, StoredRoom } from "./shared";
import {
  actorId,
  appendEvent,
  asRecord,
  eventId,
  getRoomByCode,
  getRoomByDrillId,
  now,
  publicRoom,
  roomKey,
  saveRoom,
  stringValue,
  numberValue,
} from "./shared";

const MAX_PLAYERS = 2;
const WARDEN_SECTOR = "sec";
const COMMANDS = new Set([
  "VERIFY_EAST_ROUTE",
  "SEND_WEST_ROUTE",
  "MARK_EAST_UNSAFE",
  "APPLY_VENTILATION",
]);

const fallbackEvidence = (): EvidenceRecord[] => [
  {
    id: "east-route-evidence",
    sectorId: WARDEN_SECTOR,
    label: "East route sensor",
    source: "Utility sector sensor feed",
    status: "UNKNOWN",
    observedAt: null,
    verifiedAt: null,
    updatedAt: now(),
    nextAction: "Verify before sending route guidance.",
  },
  {
    id: "smoke-source-evidence",
    sectorId: WARDEN_SECTOR,
    label: "Smoke source reading",
    source: "Electrical service monitor",
    status: "UNKNOWN",
    observedAt: null,
    verifiedAt: null,
    updatedAt: now(),
    nextAction: "Compare the source with the route status.",
  },
];

function storedRoom(input: Record<string, unknown>, actor: string): StoredRoom {
  const code = stringValue(input.code).toUpperCase();
  const drillId = stringValue(input.drillId, `drill_${code}`);
  return {
    pk: roomKey(code).pk,
    sk: roomKey(code).sk,
    recordType: "META",
    drillId,
    code,
    hostId: actor,
    maxPlayers: MAX_PLAYERS,
    phase: "lobby",
    startsAt: null,
    participants: [],
    createdAt: now(),
    scenarioVersion: stringValue(input.scenarioVersion, "campus-block-v1"),
    seed: numberValue(input.seed, 18421),
    outcome: null,
    stateVersion: 1,
    eventSequence: 0,
    routeStatus: "clear",
    interventionApplied: false,
    evidence: fallbackEvidence(),
    latestMessage: null,
  };
}

function participantFrom(value: unknown) {
  const input = asRecord(value);
  return {
    id: stringValue(input.id, `participant-${Math.random().toString(36).slice(2, 8)}`),
    name: stringValue(input.name, "participant").slice(0, 32),
    role: null,
    sectorId: null,
    joinedAt: numberValue(input.joinedAt, now()),
    connected: true,
    reconnectUntil: null,
  };
}

function identityFor(event: AppSyncEvent, input: Record<string, unknown>) {
  return actorId(event, input.playerId ?? input.hostId);
}

function participantFor(room: StoredRoom, id: string) {
  return room.participants.find((participant) => participant.id === id) ?? null;
}

function assignRoles(room: StoredRoom) {
  const sorted = [...room.participants].sort((a, b) => a.id.localeCompare(b.id));
  const [evacuee, ...wardens] = sorted;
  const assigned = [
    ...(evacuee ? [{ ...evacuee, role: "evacuee", sectorId: null }] : []),
    ...wardens.map((participant) => ({
      ...participant,
      role: "warden",
      sectorId: WARDEN_SECTOR,
    })),
  ];
  return room.participants.map(
    (participant) => assigned.find((item) => item.id === participant.id) ?? participant,
  );
}

async function writeEvent(
  room: StoredRoom,
  eventType: string,
  actor: string | null,
  actorRole: string | null,
  sectorId: string | null,
  payload: unknown,
) {
  const sequence = room.eventSequence + 1;
  room.eventSequence = sequence;
  await appendEvent(room, {
    drillId: room.drillId,
    eventId: eventId(room, sequence),
    sequence,
    eventType,
    actorRole,
    actorId: actor,
    sectorId,
    payload,
    serverTime: now(),
  });
}

function acknowledgement(
  room: StoredRoom,
  command: string,
  accepted: boolean,
  reason: string | null,
) {
  return {
    id: `${room.drillId}:ack:${room.eventSequence}`,
    command,
    accepted,
    reason,
    at: now(),
    stateVersion: room.stateVersion,
    eventSequence: room.eventSequence,
  };
}

function routeMessage(room: StoredRoom, senderId: string): RouteMessage {
  const timestamp = now();
  return {
    messageId: `${room.drillId}:message:${room.eventSequence}`,
    drillId: room.drillId,
    senderId,
    senderSector: WARDEN_SECTOR,
    targetSector: "lobby",
    direction: "west",
    kind: "route",
    confidence: "verified",
    urgency: "urgent",
    createdAt: timestamp,
    expiresAt: timestamp + 12_000,
    caption: "East route is unsafe. Proceed to the verified west route.",
    acknowledgedAt: null,
  };
}

async function createDrill(event: AppSyncEvent) {
  const input = asRecord(event.arguments?.input);
  const room = storedRoom(input, identityFor(event, input));
  await saveRoom(room);
  await writeEvent(room, "drill_created", room.hostId, null, null, {
    scenarioVersion: room.scenarioVersion,
    seed: room.seed,
  });
  await saveRoom(room);
  return publicRoom(room);
}

async function joinDrill(event: AppSyncEvent) {
  const input = asRecord(event.arguments?.input);
  const room = await getRoomByCode(stringValue(input.code).toUpperCase());
  if (!room) throw new Error("drill not found");
  if (room.phase !== "lobby" && room.phase !== "preparing")
    throw new Error("drill unavailable");

  const participant = participantFrom(input.participant);
  const actor = identityFor(event, participant);
  const existing = participantFor(room, actor) ?? participantFor(room, participant.id);
  if (!existing && room.participants.length >= room.maxPlayers) throw new Error("drill full");

  room.participants = existing
    ? room.participants.map((item) =>
        item.id === existing.id
          ? { ...item, name: participant.name, connected: true, reconnectUntil: null }
          : item,
      )
    : [...room.participants, { ...participant, id: actor }];
  if (!room.hostId) room.hostId = actor;
  if (room.participants.length >= room.maxPlayers && room.phase === "lobby") {
    room.phase = "preparing";
    room.startsAt = now() + 10_000;
  }
  room.stateVersion += 1;
  await writeEvent(room, "role_joined", actor, null, null, { name: participant.name });
  await saveRoom(room);
  return publicRoom(room);
}

async function startDrill(event: AppSyncEvent) {
  const args = event.arguments ?? {};
  const room = await getRoomByDrillId(stringValue(args.drillId));
  if (!room) return { ok: false, error: "notfound" };
  const actor = actorId(event, args.playerId);
  if (room.hostId !== actor) return { ok: false, error: "not-host" };
  if (room.participants.length < room.maxPlayers) return { ok: false, error: "not-ready" };
  if (room.phase === "active") return { ok: false, error: "started" };
  room.phase = "active";
  room.startsAt = null;
  room.participants = assignRoles(room);
  room.stateVersion += 1;
  await writeEvent(room, "drill_started", actor, "coordinator", null, {});
  await saveRoom(room);
  return { ok: true, error: null };
}

async function submitIntent(event: AppSyncEvent) {
  const args = event.arguments ?? {};
  const room = await getRoomByDrillId(stringValue(args.drillId));
  if (!room) throw new Error("drill not found");
  const intent = asRecord(args.intent);
  const participant = participantFor(room, actorId(event, intent.playerId));
  if (!participant) throw new Error("participant is not a member of this drill");

  if (intent.type === "evacuee-state") {
    if (participant.role !== "evacuee") throw new Error("role cannot publish evacuee state");
    // Movement is intentionally handed to the room worker in the target deployment.
    return { acknowledgement: null, routeMessage: null, evidence: null };
  }

  if (participant.role !== "warden") throw new Error("warden role required");
  if (intent.type === "observe-evidence") {
    const evidenceId = stringValue(intent.evidenceId);
    const evidence = room.evidence.find((item) => item.id === evidenceId);
    if (!evidence || evidence.sectorId !== participant.sectorId) throw new Error("evidence unavailable");
    evidence.status = "OBSERVED";
    evidence.observedAt ??= now();
    evidence.updatedAt = now();
    room.stateVersion += 1;
    await writeEvent(room, "evidence_observed", participant.id, participant.role, participant.sectorId, { evidenceId });
    await saveRoom(room);
    return { acknowledgement: null, routeMessage: null, evidence };
  }

  const command = stringValue(intent.command);
  if (!COMMANDS.has(command)) throw new Error("unsupported command");
  const evidenceId = stringValue(intent.evidenceId, "east-route-evidence");
  const evidence = room.evidence.find((item) => item.id === evidenceId);
  if (!evidence || evidence.sectorId !== participant.sectorId)
    return { acknowledgement: acknowledgement(room, command, false, "evidence unavailable"), routeMessage: null, evidence: null };
  if (command === "VERIFY_EAST_ROUTE" && evidence.status !== "OBSERVED")
    return { acknowledgement: acknowledgement(room, command, false, "observe the evidence first"), routeMessage: null, evidence: null };
  if (command !== "VERIFY_EAST_ROUTE" && evidence.status !== "VERIFIED")
    return { acknowledgement: acknowledgement(room, command, false, "verify the route evidence first"), routeMessage: null, evidence: null };
  if (command === "APPLY_VENTILATION" && room.interventionApplied)
    return { acknowledgement: acknowledgement(room, command, false, "intervention already applied"), routeMessage: null, evidence: null };

  let message: RouteMessage | null = null;
  if (command === "VERIFY_EAST_ROUTE") {
    evidence.status = "VERIFIED";
    evidence.verifiedAt = now();
  } else if (command === "SEND_WEST_ROUTE") {
    room.routeStatus = "unsafe";
    message = routeMessage(room, participant.id);
    room.latestMessage = message;
  } else if (command === "MARK_EAST_UNSAFE") {
    room.routeStatus = "unsafe";
  } else {
    room.interventionApplied = true;
    room.routeStatus = "intervened";
  }
  evidence.updatedAt = now();
  room.stateVersion += 1;
  await writeEvent(room, command.toLowerCase(), participant.id, participant.role, participant.sectorId, {
    evidenceId,
    idempotencyKey: stringValue(intent.idempotencyKey),
  });
  await saveRoom(room);
  return {
    acknowledgement: acknowledgement(room, command, true, null),
    routeMessage: message,
    evidence: command === "VERIFY_EAST_ROUTE" ? evidence : null,
  };
}

async function leaveDrill(event: AppSyncEvent) {
  const args = event.arguments ?? {};
  const room = await getRoomByDrillId(stringValue(args.drillId));
  if (!room) return { ok: false, error: "notfound" };
  const actor = actorId(event, args.playerId);
  const participant = participantFor(room, actor);
  if (!participant) return { ok: true, error: null };
  room.participants = room.participants.map((item) =>
    item.id === actor
      ? { ...item, connected: false, reconnectUntil: now() + 20_000 }
      : item,
  );
  if (room.phase === "active" || room.phase === "assembly") {
    room.phase = "failed";
    room.outcome = "participant-left";
  }
  room.stateVersion += 1;
  await writeEvent(room, "role_disconnected", actor, participant.role, participant.sectorId, {});
  await saveRoom(room);
  return { ok: true, error: null };
}

export async function handler(event: AppSyncEvent) {
  const field = event.info?.fieldName;
  switch (field) {
    case "drill": {
      const code = stringValue(event.arguments?.code).toUpperCase();
      const room = await getRoomByCode(code);
      return room ? publicRoom(room) : null;
    }
    case "createDrill":
      return createDrill(event);
    case "joinDrill":
      return joinDrill(event);
    case "startDrill":
      return startDrill(event);
    case "submitIntent":
      return submitIntent(event);
    case "leaveDrill":
      return leaveDrill(event);
    case "publishDrillEvent":
      return event.arguments?.event ?? null;
    default:
      throw new Error(`Unsupported AppSync field: ${field ?? "unknown"}`);
  }
}
