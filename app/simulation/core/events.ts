import type { RoomId } from "../level";

export const EVENT_SCHEMA_VERSION = 1 as const;

export type EventSource = "simulation" | "evacuee" | "warden" | "system";
export type EventActorKind = "system" | "player" | "warden" | "occupant";

export type HazardClassification = "clear" | "caution" | "dangerous" | "blocked";
export type ConnectorStatus = "open" | "compromised" | "blocked";

export type SimulationEventBody =
  | {
      type: "run_started";
      payload: { scenarioId: string; scenarioVersion: string; seed: number };
    }
  | {
      type: "phase_changed";
      payload: { from: string; to: string };
    }
  | {
      type: "fire_ignited";
      payload: { originRoomId: RoomId };
    }
  | {
      type: "hazard_threshold_crossed";
      payload: {
        previous: HazardClassification;
        current: HazardClassification;
        density: number;
      };
    }
  | {
      type: "connector_status_changed";
      payload: {
        previous: ConnectorStatus;
        current: ConnectorStatus;
        reason: string;
      };
    }
  | {
      type: "occupant_spawned";
      payload: { occupantId: string; profile: string };
    }
  | {
      type: "occupant_decision";
      payload: { occupantId: string; decision: string; target?: string };
    }
  | {
      type: "route_assigned" | "route_changed";
      payload: { occupantId: string; targetExit: string | null; connectorIds: string[] };
    }
  | {
      type: "room_entered";
      payload: { occupantId: string; roomId: RoomId };
    }
  | {
      type: "exposure_threshold_crossed";
      payload: { occupantId: string; previous: number; current: number };
    }
  | {
      type: "exposure_sampled";
      payload: {
        occupantId: string;
        roomId: RoomId;
        density: number;
        exposure: number;
        air: number;
        health: number;
      };
    }
  | {
      type: "injury_changed";
      payload: { occupantId: string; previous: string; current: string };
    }
  | {
      type: "assistance_requested";
      payload: { occupantId: string; reason: string };
    }
  | {
      type: "congestion_observed";
      payload: { occupantId: string; waitingOccupants: number; capacity: number };
    }
  | {
      type: "intervention_applied";
      payload: { interventionId: string; active: boolean };
    }
  | {
      type: "message_sent";
      payload: { messageId: string; direction: string; confidence: string };
    }
  | {
      type: "message_acknowledged";
      payload: { messageId: string; acknowledged: boolean };
    }
  | {
      type: "peer_assistance_requested";
      payload: { occupantId: string; messageId: string; reason: string };
    }
  | {
      type: "occupant_assembled";
      payload: { occupantId: string; assemblyZoneId: string; exitId: string };
    }
  | {
      type: "occupant_missing";
      payload: { occupantId: string; lastKnownRoomId: RoomId | null };
    }
  | {
      type: "run_completed";
      payload: { reason: string };
    }
  | {
      type: "run_failed";
      payload: { reason: string };
    };

export interface SimulationEventEnvelope {
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  runId: string;
  sequence: number;
  tick: number;
  source: EventSource;
  actorId?: string;
  actorKind?: EventActorKind;
  roomId?: RoomId;
  connectorId?: string;
}

export type SimulationEvent = SimulationEventEnvelope & SimulationEventBody;

export interface SimulationEventLog {
  runId: string;
  nextSequence: number;
  events: SimulationEvent[];
}

export interface EventContext {
  actorId?: string;
  actorKind?: EventActorKind;
  roomId?: RoomId;
  connectorId?: string;
}

export interface SimulationEventDraft {
  body: SimulationEventBody;
  context?: EventContext;
}

export function createEventLog(runId: string): SimulationEventLog {
  if (!runId.trim()) throw new Error("Simulation run ID is required");
  return { runId, nextSequence: 1, events: [] };
}

export function cloneEventLog(log: SimulationEventLog): SimulationEventLog {
  return {
    runId: log.runId,
    nextSequence: log.nextSequence,
    events: [...log.events],
  };
}

export function recordSimulationEvent(
  log: SimulationEventLog,
  tick: number,
  source: EventSource,
  body: SimulationEventBody,
  context: EventContext = {},
): SimulationEvent {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new Error("Simulation event tick must be a non-negative integer");
  }
  const previous = log.events[log.events.length - 1];
  if (previous && tick < previous.tick) {
    throw new Error("Simulation event ticks must be monotonic");
  }

  const event: SimulationEvent = {
    schemaVersion: EVENT_SCHEMA_VERSION,
    runId: log.runId,
    sequence: log.nextSequence,
    tick,
    source,
    ...context,
    ...body,
  };
  log.events.push(event);
  log.nextSequence += 1;
  return event;
}
