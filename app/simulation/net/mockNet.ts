"use client";

import { assignRoles, resolveRoom } from "./roles";
import { getSectorSmoke, VENTILATION_SMOKE_FACTOR } from "../smoke";
import { MARKERS, type MarkerDef } from "../level";
import type {
  ClientIntent,
  CommandAcknowledgement,
  DrillRoom,
  EvacueeState,
  EvidenceRecord,
  NetClient,
  NetEvent,
  Participant,
  RouteMessage,
  StartResult,
  WardenState,
} from "./types";
import { COUNTDOWN_MS, WARDEN_SECTORS } from "./types";

type MockProjection = {
  room: DrillRoom;
  evacueeState: EvacueeState | null;
  evidence: EvidenceRecord[];
  routeStatus: "clear" | "unsafe" | "intervened";
  interventionApplied: boolean;
  latestMessage: RouteMessage | null;
  lastAcknowledgement: CommandAcknowledgement | null;
  processedCommands: Record<string, CommandAcknowledgement>;
  stateVersion: number;
  eventSequence: number;
};

type WireMessage =
  | { senderId: string; event: NetEvent };

const memory = new Map<string, MockProjection>();
const clients = new Map<string, Set<MockNet>>();
const ROOM_PREFIX = "campusevac:mock-room:";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function storageRead(code: string): Promise<MockProjection | null> {
  try {
    const res = await fetch(`/api/mockNet?code=${code}`);
    if (res.ok) {
      const data = await res.json();
      return data.projection as MockProjection | null;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

async function storageWrite(projection: MockProjection) {
  try {
    await fetch('/api/mockNet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projection)
    });
  } catch (e) {
    console.error(e);
  }
}

async function getProjection(code: string) {
  const stored = await storageRead(code);
  if (stored) memory.set(code, stored);
  return stored ?? memory.get(code) ?? null;
}

const participantChannel = (code: string, id: string) =>
  `campusevac:mock:${code}:${id}`;

function markerEvidence(marker: MarkerDef, now: number): EvidenceRecord {
  return {
    id: marker.id,
    sectorId: marker.room,
    label: marker.label,
    source: marker.source ?? "Authored sector evidence",
    status: "UNKNOWN",
    observedAt: null,
    verifiedAt: null,
    updatedAt: now,
    nextAction: marker.nextAction ?? "Inspect the evidence before communicating.",
  };
}

function newProjection(room: DrillRoom): MockProjection {
  const now = Date.now();
  return {
    room,
    evacueeState: null,
    evidence: MARKERS.filter((marker) => marker.kind === "evidence").map((marker) =>
      markerEvidence(marker, now),
    ),
    routeStatus: "clear",
    interventionApplied: false,
    latestMessage: null,
    lastAcknowledgement: null,
    processedCommands: {},
    stateVersion: 0,
    eventSequence: 0,
  };
}

async function save(projection: MockProjection) {
  memory.set(projection.room.code, projection);
  await storageWrite(projection);
}

function connectedClients(code: string) {
  return clients.get(code) ?? new Set<MockNet>();
}

function participantFor(projection: MockProjection, id: string) {
  return projection.room.participants.find((participant) => participant.id === id) ?? null;
}

function assignedSector(participant: Participant) {
  return participant.sectorId ?? WARDEN_SECTORS[0];
}

function wardenStateFor(
  projection: MockProjection,
  participant: Participant,
): WardenState {
  const assigned = assignedSector(participant);
  const state = projection.evacueeState;
  const marker =
    state && state.sectorId === assigned
      ? { position: state.position, sectorId: state.sectorId }
      : null;
  const smokeElapsed = state?.hazardElapsed ?? 0;
  return {
    kind: "warden",
    t: Date.now(),
    stateVersion: projection.stateVersion,
    eventSequence: projection.eventSequence,
    assignedSector: assigned,
    evacuee: marker,
    air: state?.air ?? 100,
    smokeIntensity:
      getSectorSmoke(assigned, smokeElapsed) *
      (projection.interventionApplied ? VENTILATION_SMOKE_FACTOR : 1),
    routeStatus: projection.routeStatus,
    interventionApplied: projection.interventionApplied,
    assemblyProgress: state?.assemblyProgress ?? (projection.room.outcome === "assembly-confirmed" ? 1 : 0),
    assemblyConfirmed:
      state?.assemblyConfirmed ?? projection.room.outcome === "assembly-confirmed",
    failed:
      state?.failed ??
      (projection.room.phase === "failed" || projection.room.outcome === "drill-failed" || projection.room.outcome === "participant-left"),
    evidence: clone(
      projection.evidence.filter((evidence) => evidence.sectorId === assigned),
    ),
    latestMessage: clone(projection.latestMessage),
    lastAcknowledgement: clone(projection.lastAcknowledgement),
    log: clone(state?.log ?? []),
  };
}

async function activeRoom(projection: MockProjection): Promise<MockProjection> {
  const room = resolveRoom(projection.room);
  if (room === projection.room) return projection;
  projection.room = room!;
  projection.room.participants = assignRoles(
    projection.room.participants,
    projection.room.seed,
  );
  projection.stateVersion += 1;
  await save(projection);
  return projection;
}

function errorAck(
  projection: MockProjection,
  command: ClientIntent & { type: "warden-command" },
  reason: string,
): CommandAcknowledgement {
  return {
    id: `${projection.room.drillId}:ack:${projection.eventSequence + 1}`,
    command: command.command,
    accepted: false,
    reason,
    at: Date.now(),
    stateVersion: projection.stateVersion,
    eventSequence: projection.eventSequence,
  };
}

/**
 * Deterministic room adapter for local development. It uses BroadcastChannel
 * when available and localStorage as a best-effort room snapshot, but never
 * exposes a hidden warden payload to the evacuee client.
 */
export class MockNet implements NetClient {
  readonly kind = "mock" as const;
  private listeners = new Set<(event: NetEvent) => void>();
  private channel: BroadcastChannel | null = null;
  private outbound = new Map<string, BroadcastChannel>();
  private code = "";
  private myId = "";
  private activationTimer: ReturnType<typeof setTimeout> | null = null;

  async connect(code: string) {
    this.code = code;
    const roomClients = clients.get(code) ?? new Set<MockNet>();
    roomClients.add(this);
    clients.set(code, roomClients);

    // Listen for room discovery broadcasts from other tabs
    if (typeof BroadcastChannel !== "undefined") {
      const discoveryChannel = new BroadcastChannel(`campusevac:discovery:${code}`);
      discoveryChannel.onmessage = async (event: MessageEvent<{ type: string; room: DrillRoom }>) => {
        if (event.data.type === "room-available") {
          const existing = await getProjection(code);
          if (!existing) {
            const projection = newProjection(event.data.room);
            await save(projection);
          }
        }
      };
      // Request room info from any tab that already has it
      discoveryChannel.postMessage({ type: "room-request" });
      // Clean up after connection is established
      setTimeout(() => discoveryChannel.close(), 5000);
    }
  }

  disconnect() {
    this.clearActivationTimer();
    const roomClients = clients.get(this.code);
    roomClients?.delete(this);
    if (roomClients && roomClients.size === 0) clients.delete(this.code);
    this.channel?.close();
    this.channel = null;
    for (const channel of this.outbound.values()) channel.close();
    this.outbound.clear();
    this.listeners.clear();
    this.code = "";
    this.myId = "";
  }

  async createRoom(room: DrillRoom) {
    const existing = await getProjection(room.code);
    if (existing) {
      this.scheduleActivation(existing.room);
      this.broadcastDiscovery(existing.room);
      return existing.room;
    }
    const projection = newProjection({ ...room, drillId: room.drillId || `drill_${room.code}` });
    await save(projection);
    this.scheduleActivation(projection.room);
    this.emitProjection(projection);
    this.broadcastDiscovery(projection.room);
    return projection.room;
  }

  private broadcastDiscovery(room: DrillRoom) {
    if (typeof BroadcastChannel === "undefined") return;
    const discoveryChannel = new BroadcastChannel(`campusevac:discovery:${room.code}`);
    discoveryChannel.postMessage({ type: "room-available", room });
    // Also listen for future requests
    discoveryChannel.onmessage = async (event: MessageEvent<{ type: string }>) => {
      if (event.data.type === "room-request") {
        const projection = await getProjection(room.code);
        if (projection) {
          discoveryChannel.postMessage({ type: "room-available", room: projection.room });
        }
      }
    };
    // Keep open for the session
    setTimeout(() => discoveryChannel.close(), 120_000);
  }

  async join(code: string, participant: Participant) {
    let projection = await getProjection(code);
    // Retry a few times to handle cross-tab localStorage propagation delays
    if (!projection) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        projection = await getProjection(code);
        if (projection) break;
      }
    }
    if (!projection) return { error: "notfound" as const };
    projection = await await activeRoom(projection);
    const existing = participantFor(projection, participant.id);
    if (!existing && projection.room.phase !== "lobby" && projection.room.phase !== "preparing")
      return { error: "unavailable" as const };
    if (!existing && projection.room.participants.length >= projection.room.maxPlayers)
      return { error: "full" as const };

    this.myId = participant.id;
    this.openChannel();
    if (existing) {
      projection.room.participants = projection.room.participants.map((item) =>
        item.id === participant.id ? { ...item, name: participant.name, connected: true } : item,
      );
    } else {
      projection.room.participants = [
        ...projection.room.participants,
        { ...participant, connected: true },
      ];
    }
    if (!projection.room.hostId) projection.room.hostId = participant.id;
    if (
      projection.room.participants.length >= projection.room.maxPlayers &&
      projection.room.phase === "lobby"
    ) {
      projection.room.phase = "preparing";
      projection.room.startsAt = Date.now() + COUNTDOWN_MS;
    }
    projection.stateVersion += 1;
    await save(projection);
    this.scheduleActivation(projection.room);
    this.emitProjection(projection);
    this.broadcastProjection(projection);
    return { room: projection.room } as const;
  }

  async leave(code: string, playerId: string) {
    const projection = await getProjection(code);
    if (!projection) return;
    projection.room.participants = projection.room.participants.filter(
      (participant) => participant.id !== playerId,
    );
    if (projection.room.phase === "active" || projection.room.phase === "assembly") {
      projection.room.phase = "failed";
      projection.room.outcome = "participant-left";
      if (projection.evacueeState) {
        projection.evacueeState = {
          ...projection.evacueeState,
          failed: true,
        };
      }
    }
    projection.stateVersion += 1;
    await save(projection);
    this.emitProjection(projection);
    this.broadcastProjection(projection);
  }

  async start(code: string, playerId: string): Promise<StartResult> {
    const projection = await getProjection(code);
    if (!projection) return { ok: false, error: "notfound" };
    await activeRoom(projection);
    if (projection.room.hostId !== playerId)
      return { ok: false, error: "not-host" };
    if (projection.room.participants.length < projection.room.maxPlayers)
      return { ok: false, error: "not-ready" };
    if (projection.room.phase === "active") return { ok: false, error: "started" };
    if (projection.room.phase !== "lobby" && projection.room.phase !== "preparing")
      return { ok: false, error: "started" };

    this.clearActivationTimer();
    projection.room.phase = "active";
    projection.room.startsAt = null;
    projection.room.participants = assignRoles(
      projection.room.participants,
      projection.room.seed,
    );
    projection.stateVersion += 1;
    await save(projection);
    this.emitProjection(projection);
    this.broadcastProjection(projection);
    return { ok: true };
  }

  async send(intent: ClientIntent) {
    const projection = await getProjection(this.code);
    if (!projection) return;
    await activeRoom(projection);
    if (intent.type === "evacuee-state") {
      const participant = participantFor(projection, this.myId);
      if (participant?.role !== "evacuee") return;
      projection.evacueeState = {
        ...intent.state,
        interventionApplied:
          intent.state.interventionApplied || projection.interventionApplied,
        routeStatus:
          projection.interventionApplied
            ? "intervened"
            : projection.routeStatus === "unsafe"
              ? "unsafe"
              : intent.state.routeStatus,
      };
      projection.routeStatus = projection.evacueeState.routeStatus;
      if (projection.evacueeState.assemblyConfirmed) {
        projection.room.phase = "assembly";
        projection.room.outcome = "assembly-confirmed";
      } else if (projection.evacueeState.failed) {
        projection.room.phase = "failed";
        projection.room.outcome = "drill-failed";
      }
      projection.stateVersion = Math.max(
        projection.stateVersion + 1,
        intent.state.stateVersion,
      );
      await save(projection);
      this.emitProjection(projection);
      this.broadcastProjection(projection);
      return;
    }

    const participant = participantFor(projection, this.myId);
    if (participant?.role !== "warden") return;
    if (intent.type === "observe-evidence") {
      const evidence = projection.evidence.find((item) => item.id === intent.evidenceId);
      if (!evidence || evidence.sectorId !== assignedSector(participant)) return;
      const now = Date.now();
      evidence.status = "OBSERVED";
      evidence.observedAt ??= now;
      evidence.updatedAt = now;
      projection.eventSequence += 1;
      projection.stateVersion += 1;
      await save(projection);
      this.emitProjection(projection);
      this.broadcastProjection(projection);
      return;
    }

    if (intent.type === "warden-command") {
      const previous = projection.processedCommands[intent.idempotencyKey];
      if (previous) {
        this.emit({ type: "command-ack", acknowledgement: clone(previous) });
        return;
      }
    }
    const ack = this.applyCommand(projection, participant, intent);
    projection.lastAcknowledgement = ack;
    if (intent.type === "warden-command")
      projection.processedCommands[intent.idempotencyKey] = ack;
    projection.stateVersion += 1;
    await save(projection);
    this.emit({ type: "command-ack", acknowledgement: ack });
    this.emitProjection(projection);
    this.broadcastProjection(projection);
  }

  onMessage(callback: (event: NetEvent) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private applyCommand(
    projection: MockProjection,
    participant: Participant,
    command: Extract<ClientIntent, { type: "warden-command" }>,
  ): CommandAcknowledgement {
    const evidenceId = command.evidenceId ?? "east-route-evidence";
    const evidence = projection.evidence.find((item) => item.id === evidenceId);
    const now = Date.now();
    const deny = (reason: string) => errorAck(projection, command, reason);

    if (projection.room.phase !== "active") return deny("drill is not active");
    if (!evidence && command.command !== "APPLY_VENTILATION")
      return deny("evidence target is unavailable");
    if (evidence && evidence.sectorId !== assignedSector(participant))
      return deny("not your sector");

    if (command.command === "VERIFY_EAST_ROUTE") {
      if (!evidence || evidence.status !== "OBSERVED")
        return deny("observe the evidence first");
      evidence.status = "VERIFIED";
      evidence.verifiedAt = now;
      evidence.updatedAt = now;
      projection.eventSequence += 1;
      return acceptedAck(projection, command.command, now);
    }

    if (command.command === "SEND_WEST_ROUTE") {
      if (!evidence || evidence.status !== "VERIFIED")
        return deny("verify the east route first");
      projection.routeStatus = "unsafe";
      projection.eventSequence += 1;
      projection.latestMessage = {
        messageId: `${projection.room.drillId}:message:${projection.eventSequence}`,
        drillId: projection.room.drillId,
        senderId: participant.id,
        senderSector: assignedSector(participant),
        targetSector: "lobby",
        direction: "west",
        kind: "route",
        confidence: "verified",
        urgency: "urgent",
        createdAt: now,
        expiresAt: now + 12_000,
        caption: "East route is unsafe. Proceed to the verified west route.",
        acknowledgedAt: null,
      };
      return acceptedAck(projection, command.command, now);
    }

    if (command.command === "MARK_EAST_UNSAFE") {
      if (!evidence || evidence.status !== "VERIFIED")
        return deny("verify the east route first");
      projection.routeStatus = "unsafe";
      projection.eventSequence += 1;
      return acceptedAck(projection, command.command, now);
    }

    if (projection.interventionApplied) return deny("intervention already applied");
    if (!evidence || evidence.status !== "VERIFIED")
      return deny("verify the route evidence first");
    projection.interventionApplied = true;
    projection.routeStatus = "intervened";
    projection.eventSequence += 1;
    if (projection.evacueeState) {
      projection.evacueeState = {
        ...projection.evacueeState,
        interventionApplied: true,
        routeStatus: "intervened",
      };
    }
    return acceptedAck(projection, command.command, now);
  }

  private emitProjection(projection: MockProjection) {
    for (const client of connectedClients(projection.room.code)) {
      client.emit({ type: "room", room: clone(projection.room) });
      const participant = participantFor(projection, client.myId);
      if (participant?.role === "evacuee" && projection.evacueeState) {
        client.emit({ type: "evacuee-state", state: clone(projection.evacueeState) });
      } else if (participant?.role === "warden") {
        client.emit({ type: "warden-state", state: wardenStateFor(projection, participant) });
      }
      if (projection.latestMessage && participant?.role === "evacuee")
        client.emit({ type: "route-message", message: clone(projection.latestMessage) });
    }
  }

  private broadcastProjection(projection: MockProjection) {
    if (typeof BroadcastChannel === "undefined") return;

    for (const participant of projection.room.participants) {
      const channel =
        participant.id === this.myId && this.channel
          ? this.channel
          : this.outboundChannel(participant.id);
      for (const event of this.eventsForParticipant(projection, participant))
        channel.postMessage({ senderId: this.myId, event } satisfies WireMessage);
    }
  }

  private outboundChannel(id: string) {
    const existing = this.outbound.get(id);
    if (existing) return existing;
    const channel = new BroadcastChannel(participantChannel(this.code, id));
    this.outbound.set(id, channel);
    return channel;
  }

  private openChannel() {
    if (typeof BroadcastChannel === "undefined" || !this.myId) return;
    this.channel?.close();
    this.channel = new BroadcastChannel(participantChannel(this.code, this.myId));
    this.channel.onmessage = (event: MessageEvent<WireMessage>) => {
      if (event.data.senderId === this.myId) return;
      if (event.data.event.type === "room")
        this.scheduleActivation(event.data.event.room);
      this.emit(event.data.event);
    };
  }

  private eventsForParticipant(
    projection: MockProjection,
    participant: Participant,
  ): NetEvent[] {
    const events: NetEvent[] = [{ type: "room", room: clone(projection.room) }];
    if (participant.role === "evacuee") {
      if (projection.evacueeState)
        events.push({ type: "evacuee-state", state: clone(projection.evacueeState) });
      if (projection.latestMessage)
        events.push({ type: "route-message", message: clone(projection.latestMessage) });
    } else if (participant.role === "warden") {
      events.push({ type: "warden-state", state: wardenStateFor(projection, participant) });
    }
    return events;
  }

  private scheduleActivation(room: DrillRoom) {
    this.clearActivationTimer();
    if (room.phase !== "preparing" || room.startsAt === null) return;

    this.activationTimer = setTimeout(async () => {
      this.activationTimer = null;
      const projection = await getProjection(room.code);
      if (!projection) return;
      const active = await activeRoom(projection);
      if (active.room.phase !== "active") return;
      this.emitProjection(active);
      this.broadcastProjection(active);
    }, Math.max(0, room.startsAt - Date.now()));
  }

  private clearActivationTimer() {
    if (this.activationTimer === null) return;
    clearTimeout(this.activationTimer);
    this.activationTimer = null;
  }

  private emit(event: NetEvent) {
    for (const callback of this.listeners) callback(event);
  }
}

function acceptedAck(
  projection: MockProjection,
  command: Extract<ClientIntent, { type: "warden-command" }>["command"],
  at: number,
): CommandAcknowledgement {
  return {
    id: `${projection.room.drillId}:ack:${projection.eventSequence}`,
    command,
    accepted: true,
    reason: null,
    at,
    stateVersion: projection.stateVersion,
    eventSequence: projection.eventSequence,
  };
}
