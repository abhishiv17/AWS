import type { SimulationEvent, SimulationEventBody } from "./events";
import type { SimulationState, WorldDefinition } from "./types";

export interface AuditableMetric {
  value: number;
  eventSequences: number[];
}

export interface OccupantTimingMetric {
  occupantId: string;
  spawnedAtTick: number | null;
  firstMovementSeconds: number | null;
  evacuationSeconds: number | null;
  eventSequences: number[];
}

export interface ExitUtilizationMetric {
  exitId: string;
  assembledCount: number;
  eventSequences: number[];
}

export interface CongestionMetric {
  connectorId: string;
  observations: number;
  maxWaitingOccupants: number;
  capacity: number | null;
  eventSequences: number[];
}

export interface ExposureMetric {
  occupantId: string;
  sampleCount: number;
  peakDensity: number;
  cumulativeExposure: number;
  minimumAir: number;
  minimumHealth: number;
  eventSequences: number[];
}

export interface SimulationMetrics {
  elapsedSeconds: number;
  eventCount: number;
  totalOccupants: AuditableMetric;
  assembledOccupants: AuditableMetric;
  missingOccupants: AuditableMetric;
  assistanceRequests: AuditableMetric;
  injuryTransitions: AuditableMetric;
  routeChanges: AuditableMetric;
  blockedConnectorChanges: AuditableMetric;
  timing: {
    averageTimeToFirstMovementSeconds: AuditableMetric | null;
    averageEvacuationTimeSeconds: AuditableMetric | null;
    byOccupant: Record<string, OccupantTimingMetric>;
  };
  exitUtilization: Record<string, ExitUtilizationMetric>;
  congestion: Record<string, CongestionMetric>;
  exposure: Record<string, ExposureMetric>;
  accountability: {
    total: number;
    assembled: number;
    missing: number;
    assistanceRequested: number;
    eventSequences: number[];
  };
}

function sequencesFor(
  events: SimulationEvent[],
  predicate: (event: SimulationEvent) => boolean,
): number[] {
  return events.filter(predicate).map((event) => event.sequence);
}

function countMetric(eventSequences: number[]): AuditableMetric {
  return { value: eventSequences.length, eventSequences };
}

function isType<T extends SimulationEventBody["type"]>(
  event: SimulationEvent,
  type: T,
): event is Extract<SimulationEvent, { type: T }> {
  return event.type === type;
}

function averageMetric(
  values: Array<{ value: number; eventSequences: number[] }>,
): AuditableMetric | null {
  if (values.length === 0) return null;
  return {
    value: values.reduce((sum, item) => sum + item.value, 0) / values.length,
    eventSequences: [...new Set(values.flatMap((item) => item.eventSequences))].sort((a, b) => a - b),
  };
}

export function deriveSimulationMetrics(
  state: SimulationState,
  world?: WorldDefinition,
): SimulationMetrics {
  const events = state.eventLog.events;
  const spawned = events.filter((event) => isType(event, "occupant_spawned"));
  const assembled = events.filter((event) => isType(event, "occupant_assembled"));
  const missing = events.filter((event) => isType(event, "occupant_missing"));
  const assistance = events.filter((event) => isType(event, "assistance_requested"));
  const injuries = sequencesFor(events, (event) => isType(event, "injury_changed"));
  const routeChanges = sequencesFor(events, (event) => isType(event, "route_changed"));
  const blockedConnectors = sequencesFor(events, (event) => {
    if (!isType(event, "connector_status_changed")) return false;
    return event.payload.current === "blocked";
  });
  const spawnByOccupant = new Map<string, SimulationEvent>();
  for (const event of spawned) {
    if (!spawnByOccupant.has(event.payload.occupantId)) spawnByOccupant.set(event.payload.occupantId, event);
  }

  const firstMovementByOccupant = new Map<string, SimulationEvent>();
  for (const event of events) {
    if (!isType(event, "route_assigned") && !isType(event, "room_entered")) continue;
    const occupantId = event.payload.occupantId;
    if (!firstMovementByOccupant.has(occupantId)) firstMovementByOccupant.set(occupantId, event);
  }

  const assembledByOccupant = new Map<string, SimulationEvent>();
  for (const event of assembled) {
    if (!assembledByOccupant.has(event.payload.occupantId)) assembledByOccupant.set(event.payload.occupantId, event);
  }

  const timingByOccupant: Record<string, OccupantTimingMetric> = {};
  for (const occupantId of spawnByOccupant.keys()) {
    const spawnedEvent = spawnByOccupant.get(occupantId)!;
    const movementEvent = firstMovementByOccupant.get(occupantId);
    const assembledEvent = assembledByOccupant.get(occupantId);
    timingByOccupant[occupantId] = {
      occupantId,
      spawnedAtTick: spawnedEvent.tick,
      firstMovementSeconds: movementEvent
        ? (movementEvent.tick - spawnedEvent.tick) * state.clock.tickDurationSeconds
        : null,
      evacuationSeconds: assembledEvent
        ? (assembledEvent.tick - spawnedEvent.tick) * state.clock.tickDurationSeconds
        : null,
      eventSequences: [
        spawnedEvent.sequence,
        ...(movementEvent ? [movementEvent.sequence] : []),
        ...(assembledEvent ? [assembledEvent.sequence] : []),
      ],
    };
  }

  const timingValues = Object.values(timingByOccupant);
  const exitUtilization: Record<string, ExitUtilizationMetric> = {};
  const exitIds = new Set([
    ...(world?.exits.map((exit) => exit.id) ?? []),
    ...state.eventLog.events
      .filter((event) => isType(event, "occupant_assembled"))
      .map((event) => event.payload.exitId),
  ]);
  for (const exit of exitIds) {
    const exitEvents = assembled.filter((event) => event.payload.exitId === exit);
    exitUtilization[exit] = {
      exitId: exit,
      assembledCount: exitEvents.length,
      eventSequences: exitEvents.length > 0
        ? exitEvents.map((event) => event.sequence)
        : spawned.map((event) => event.sequence),
    };
  }

  const congestion: Record<string, CongestionMetric> = {};
  for (const event of events.filter((item) => isType(item, "congestion_observed"))) {
    const connectorId = event.connectorId ?? "unknown";
    const current = congestion[connectorId] ?? {
      connectorId,
      observations: 0,
      maxWaitingOccupants: 0,
      capacity: event.payload.capacity,
      eventSequences: [],
    };
    current.observations += 1;
    current.maxWaitingOccupants = Math.max(current.maxWaitingOccupants, event.payload.waitingOccupants);
    current.eventSequences.push(event.sequence);
    congestion[connectorId] = current;
  }

  const exposure: Record<string, ExposureMetric> = {};
  for (const event of events.filter((item) => isType(item, "exposure_sampled"))) {
    const occupantId = event.payload.occupantId;
    const current = exposure[occupantId] ?? {
      occupantId,
      sampleCount: 0,
      peakDensity: 0,
      cumulativeExposure: 0,
      minimumAir: 100,
      minimumHealth: 100,
      eventSequences: [],
    };
    current.sampleCount += 1;
    current.peakDensity = Math.max(current.peakDensity, event.payload.density);
    current.cumulativeExposure = Math.max(current.cumulativeExposure, event.payload.exposure);
    current.minimumAir = Math.min(current.minimumAir, event.payload.air);
    current.minimumHealth = Math.min(current.minimumHealth, event.payload.health);
    current.eventSequences.push(event.sequence);
    exposure[occupantId] = current;
  }

  const averageTimeToFirstMovement = averageMetric(
    timingValues
      .filter((item) => item.firstMovementSeconds !== null)
      .map((item) => ({ value: item.firstMovementSeconds!, eventSequences: item.eventSequences })),
  );
  const averageEvacuation = averageMetric(
    timingValues
      .filter((item) => item.evacuationSeconds !== null)
      .map((item) => ({ value: item.evacuationSeconds!, eventSequences: item.eventSequences })),
  );
  const assembledSequences = assembled.map((event) => event.sequence);
  const missingSequences = missing.map((event) => event.sequence);
  const assistanceSequences = assistance.map((event) => event.sequence);

  return {
    elapsedSeconds: state.clock.elapsedSeconds,
    eventCount: events.length,
    totalOccupants: countMetric(spawned.map((event) => event.sequence)),
    assembledOccupants: countMetric(assembledSequences),
    missingOccupants: countMetric(missingSequences),
    assistanceRequests: countMetric(assistanceSequences),
    injuryTransitions: countMetric(injuries),
    routeChanges: countMetric(routeChanges),
    blockedConnectorChanges: countMetric(blockedConnectors),
    timing: {
      averageTimeToFirstMovementSeconds: averageTimeToFirstMovement,
      averageEvacuationTimeSeconds: averageEvacuation,
      byOccupant: timingByOccupant,
    },
    exitUtilization,
    congestion,
    exposure,
    accountability: {
      total: spawned.length,
      assembled: assembled.length,
      missing: missing.length,
      assistanceRequested: new Set(assistance.map((event) => event.payload.occupantId)).size,
      eventSequences: [...spawned, ...assembled, ...missing, ...assistance]
        .map((event) => event.sequence)
        .sort((a, b) => a - b),
    },
  };
}
