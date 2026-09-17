import { advanceSimulationClock, createSimulationClock } from "./clock";
import {
  cloneEventLog,
  createEventLog,
  recordSimulationEvent,
  type EventContext,
  type EventSource,
  type SimulationEventBody,
  type SimulationEventDraft,
  type SimulationEvent,
} from "./events";
import { advanceHazards } from "./hazards";
import { advanceOccupants } from "./occupants";
import { validateScenario } from "./scenario";
import type {
  AssemblyZoneState,
  ConnectorState,
  HazardReading,
  OccupantState,
  ScenarioDefinition,
  SimulationState,
} from "./types";

function requireValidScenario(scenario: ScenarioDefinition): void {
  const errors = validateScenario(scenario);
  if (errors.length > 0) throw new Error(`Invalid simulation scenario: ${errors.join("; ")}`);
}

function initialHazards(scenario: ScenarioDefinition): Record<string, HazardReading> {
  return Object.fromEntries(
    scenario.world.rooms.map((room) => [
      room.id,
      { density: 0, classification: "clear", updatedAtTick: 0 },
    ]),
  );
}

function initialConnectors(scenario: ScenarioDefinition): Record<string, ConnectorState> {
  return Object.fromEntries(
    scenario.world.connectors.map((connector) => [
      connector.id,
      { status: "open", smokeDensity: 0, updatedAtTick: 0, reason: null },
    ]),
  );
}

function initialOccupants(scenario: ScenarioDefinition): Record<string, OccupantState> {
  return Object.fromEntries(
    scenario.occupants.map((occupant) => [
      occupant.id,
      {
        id: occupant.id,
        profile: occupant.profile,
        mobility: occupant.mobility,
        status: "waiting",
        roomId: occupant.spawnRoomId,
        position: occupant.spawnPosition,
        health: 100,
        air: 100,
        exposure: 0,
        injury: "none",
        behavior: occupant.behavior ?? "calm",
        accessibility: occupant.accessibility ?? "standard",
        decisionDelayTicks:
          occupant.decisionDelayTicks ?? (occupant.behavior === "hesitant" ? 3 : 1),
        targetExitId: null,
        route: [],
        routeIndex: 0,
        travelConnectorId: null,
        travelTicksRemaining: 0,
        lastDecisionTick: null,
        assembledAtTick: null,
        injuredAtTick: null,
        assistanceRequestedAtTick: null,
      },
    ]),
  );
}

function initialAssemblies(scenario: ScenarioDefinition): Record<string, AssemblyZoneState> {
  return Object.fromEntries(
    scenario.world.assemblyZones.map((zone) => [
      zone.id,
      { zoneId: zone.id, arrivedOccupantIds: [], queuedOccupantIds: [] },
    ]),
  );
}

export function createInitialSimulationState(
  scenario: ScenarioDefinition,
  runId: string,
): SimulationState {
  requireValidScenario(scenario);
  if (!runId.trim()) throw new Error("Simulation run ID is required");

  return {
    runId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    seed: scenario.seed,
    phase: "idle",
    clock: createSimulationClock(),
    incident: {
      originRoomId: scenario.incident.originRoomId,
      ignited: false,
      intensity: 0,
      ventilationActive: false,
    },
    hazards: initialHazards(scenario),
    connectors: initialConnectors(scenario),
    occupants: initialOccupants(scenario),
    assemblies: initialAssemblies(scenario),
    eventLog: createEventLog(runId),
  };
}

export function startSimulation(state: SimulationState): SimulationState {
  if (state.phase !== "idle") throw new Error(`Cannot start simulation in phase ${state.phase}`);

  const eventLog = cloneEventLog(state.eventLog);
  recordSimulationEvent(eventLog, state.clock.tick, "system", {
    type: "run_started",
    payload: {
      scenarioId: state.scenarioId,
      scenarioVersion: state.scenarioVersion,
      seed: state.seed,
    },
  });
  recordSimulationEvent(eventLog, state.clock.tick, "system", {
    type: "phase_changed",
    payload: { from: "idle", to: "running" },
  });
  for (const occupant of Object.values(state.occupants).sort((left, right) => left.id.localeCompare(right.id))) {
    recordSimulationEvent(
      eventLog,
      state.clock.tick,
      "simulation",
      {
        type: "occupant_spawned",
        payload: { occupantId: occupant.id, profile: occupant.profile },
      },
      { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
    );
  }

  return { ...state, phase: "running", eventLog };
}

export function advanceSimulation(state: SimulationState, ticks = 1): SimulationState {
  if (state.phase !== "running") throw new Error(`Cannot advance simulation in phase ${state.phase}`);
  return { ...state, clock: advanceSimulationClock(state.clock, ticks) };
}

function appendDrafts(
  eventLog: ReturnType<typeof cloneEventLog>,
  tick: number,
  drafts: SimulationEventDraft[],
): void {
  for (const event of drafts) {
    recordSimulationEvent(eventLog, tick, "simulation", event.body, event.context);
  }
}

function stepOne(
  state: SimulationState,
  scenario: ScenarioDefinition,
): SimulationState {
  const nextTick = state.clock.tick + 1;
  const eventLog = cloneEventLog(state.eventLog);
  const clock = advanceSimulationClock(state.clock);
  let nextState: SimulationState = { ...state, clock, eventLog };

  const hazards = advanceHazards(nextState, scenario, nextTick);
  nextState = {
    ...nextState,
    incident: hazards.incident,
    hazards: hazards.hazards,
    connectors: hazards.connectors,
  };
  appendDrafts(eventLog, nextTick, hazards.events);

  const occupants = advanceOccupants(nextState, scenario, nextTick);
  nextState = {
    ...nextState,
    occupants: occupants.occupants,
    assemblies: occupants.assemblies,
  };
  appendDrafts(eventLog, nextTick, occupants.events);

  const allAssembled =
    scenario.occupants.length > 0 &&
    Object.values(nextState.occupants).every((occupant) => occupant.status === "assembled");
  if (allAssembled) {
    recordSimulationEvent(eventLog, nextTick, "simulation", {
      type: "run_completed",
      payload: { reason: "All occupants reached an assembly zone" },
    });
    return { ...nextState, phase: "completed" };
  }

  if (scenario.durationSeconds !== undefined && clock.elapsedSeconds >= scenario.durationSeconds) {
    const missing = { ...nextState.occupants };
    for (const occupant of Object.values(missing)) {
      if (occupant.status === "assembled" || occupant.status === "missing") continue;
      occupant.status = "missing";
      recordSimulationEvent(eventLog, nextTick, "simulation", {
        type: "occupant_missing",
        payload: { occupantId: occupant.id, lastKnownRoomId: occupant.roomId },
      }, { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId });
    }
    recordSimulationEvent(eventLog, nextTick, "simulation", {
      type: "run_failed",
      payload: { reason: "Scenario duration elapsed before accountability completed" },
    });
    return { ...nextState, occupants: missing, phase: "failed" };
  }

  return nextState;
}

export function stepSimulation(
  state: SimulationState,
  scenario: ScenarioDefinition,
  ticks = 1,
): SimulationState {
  if (state.phase !== "running") throw new Error(`Cannot step simulation in phase ${state.phase}`);
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error("Simulation steps must be a non-negative integer");
  }

  let nextState = state;
  for (let index = 0; index < ticks && nextState.phase === "running"; index += 1) {
    nextState = stepOne(nextState, scenario);
  }
  return nextState;
}

export function setVentilationActive(
  state: SimulationState,
  active: boolean,
  interventionId = "ventilation-override",
): SimulationState {
  if (state.incident.ventilationActive === active) return state;
  const eventLog = cloneEventLog(state.eventLog);
  recordSimulationEvent(eventLog, state.clock.tick, "warden", {
    type: "intervention_applied",
    payload: { interventionId, active },
  }, { actorKind: "warden" });
  return {
    ...state,
    incident: { ...state.incident, ventilationActive: active },
    eventLog,
  };
}

export function appendSimulationEvent(
  state: SimulationState,
  source: EventSource,
  body: SimulationEventBody,
  context: EventContext = {},
): SimulationState {
  const eventLog = cloneEventLog(state.eventLog);
  recordSimulationEvent(eventLog, state.clock.tick, source, body, context);
  return { ...state, eventLog };
}

export function latestSimulationEvent(state: SimulationState): SimulationEvent | null {
  return state.eventLog.events[state.eventLog.events.length - 1] ?? null;
}
