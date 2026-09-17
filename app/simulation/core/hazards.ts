import type { RoomId } from "../level";
import type {
  EventContext,
  SimulationEventBody,
  SimulationEventDraft,
} from "./events";
import type {
  ConnectorState,
  HazardReading,
  IncidentState,
  ScenarioDefinition,
  SimulationState,
} from "./types";

export const HAZARD_DENSITY_THRESHOLDS = {
  caution: 0.15,
  dangerous: 0.45,
  blocked: 0.7,
} as const;

export const DEFAULT_SMOKE_CONDUCTANCE = 0.12;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function classifyHazard(density: number): HazardReading["classification"] {
  if (density < HAZARD_DENSITY_THRESHOLDS.caution) return "clear";
  if (density < HAZARD_DENSITY_THRESHOLDS.dangerous) return "caution";
  if (density < HAZARD_DENSITY_THRESHOLDS.blocked) return "dangerous";
  return "blocked";
}

function draft(
  body: SimulationEventBody,
  context?: EventContext,
): SimulationEventDraft {
  return { body, context };
}

function initialDensities(state: SimulationState): Record<RoomId, number> {
  return Object.fromEntries(
    Object.entries(state.hazards).map(([roomId, reading]) => [roomId, reading.density]),
  ) as Record<RoomId, number>;
}

export interface HazardStepResult {
  incident: IncidentState;
  hazards: Record<RoomId, HazardReading>;
  connectors: Record<string, ConnectorState>;
  events: SimulationEventDraft[];
}

export function advanceHazards(
  state: SimulationState,
  scenario: ScenarioDefinition,
  nextTick: number,
): HazardStepResult {
  const dt = state.clock.tickDurationSeconds;
  const elapsedSeconds = nextTick * dt;
  const currentDensities = initialDensities(state);
  const changes = Object.fromEntries(
    Object.keys(currentDensities).map((roomId) => [roomId, 0]),
  ) as Record<RoomId, number>;
  const events: SimulationEventDraft[] = [];

  const wasIgnited = state.incident.ignited;
  const ignited = elapsedSeconds >= scenario.incident.ignitionDelaySeconds;
  const ventilationMultiplier = state.incident.ventilationActive
    ? scenario.incident.ventilationFactor
    : 1;
  const generation = ignited
    ? scenario.incident.generationRate * ventilationMultiplier * dt
    : 0;

  changes[scenario.incident.originRoomId] += generation;
  if (ignited && !wasIgnited) {
    events.push(
      draft(
        {
          type: "fire_ignited",
          payload: { originRoomId: scenario.incident.originRoomId },
        },
        { roomId: scenario.incident.originRoomId, actorKind: "system" },
      ),
    );
  }

  for (const connector of scenario.world.connectors) {
    const connectorState = state.connectors[connector.id];
    if (connectorState?.status === "blocked") continue;

    const fromDensity = currentDensities[connector.from] ?? 0;
    const toDensity = currentDensities[connector.to] ?? 0;
    const conductance = connector.smokeConductance ?? DEFAULT_SMOKE_CONDUCTANCE;
    const transfer = Math.abs(fromDensity - toDensity) * conductance * dt;
    if (fromDensity > toDensity) {
      changes[connector.from] -= transfer;
      changes[connector.to] += transfer;
    } else if (toDensity > fromDensity) {
      changes[connector.to] -= transfer;
      changes[connector.from] += transfer;
    }
  }

  const dissipationMultiplier = state.incident.ventilationActive ? 3 : 1;
  const hazards = {} as Record<RoomId, HazardReading>;
  for (const room of scenario.world.rooms) {
    const current = currentDensities[room.id] ?? 0;
    const dissipation = current * scenario.incident.dissipationRate * dissipationMultiplier * dt;
    const density = room.id === "outside"
      ? 0
      : clamp(current + (changes[room.id] ?? 0) - dissipation);
    const classification = classifyHazard(density);
    const previous = state.hazards[room.id];
    hazards[room.id] = { density, classification, updatedAtTick: nextTick };

    if (previous && previous.classification !== classification) {
      events.push(
        draft(
          {
            type: "hazard_threshold_crossed",
            payload: {
              previous: previous.classification,
              current: classification,
              density,
            },
          },
          { roomId: room.id, actorKind: "system" },
        ),
      );
    }
  }

  const connectors = {} as Record<string, ConnectorState>;
  for (const connector of scenario.world.connectors) {
    const previous = state.connectors[connector.id];
    const smokeDensity = Math.max(
      hazards[connector.from]?.density ?? 0,
      hazards[connector.to]?.density ?? 0,
    );
    const status = smokeDensity >= HAZARD_DENSITY_THRESHOLDS.blocked
      ? "blocked"
      : smokeDensity >= HAZARD_DENSITY_THRESHOLDS.dangerous
        ? "compromised"
        : "open";
    connectors[connector.id] = {
      status,
      smokeDensity,
      updatedAtTick: nextTick,
      reason: status === "open" ? null : `Smoke density ${smokeDensity.toFixed(3)}`,
    };

    if (previous && previous.status !== status) {
      events.push(
        draft(
          {
            type: "connector_status_changed",
            payload: {
              previous: previous.status,
              current: status,
              reason: connectors[connector.id].reason ?? "Smoke cleared",
            },
          },
          { connectorId: connector.id, actorKind: "system" },
        ),
      );
    }
  }

  return {
    incident: {
      ...state.incident,
      ignited,
      intensity: clamp(state.incident.intensity + generation),
    },
    hazards,
    connectors,
    events,
  };
}
