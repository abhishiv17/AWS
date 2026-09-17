import type { RoomId } from "../level";
import type { EventContext, SimulationEventBody, SimulationEventDraft } from "./events";
import { findSafestExit } from "./routing";
import type {
  AssemblyZoneState,
  InjuryState,
  OccupantState,
  ScenarioDefinition,
  SimulationState,
} from "./types";

const AIR_DRAIN_PER_SECOND = 2.4;
const HEALTH_DRAIN_PER_SECOND = 1.25;
const DISTRESS_DENSITY = 0.45;
const EXPOSURE_EVENT_THRESHOLD = 1;

function draft(body: SimulationEventBody, context?: EventContext): SimulationEventDraft {
  return { body, context };
}

function cloneOccupants(state: SimulationState): Record<string, OccupantState> {
  return Object.fromEntries(
    Object.entries(state.occupants).map(([id, occupant]) => [
      id,
      { ...occupant, position: [...occupant.position] as OccupantState["position"], route: [...occupant.route] },
    ]),
  );
}

function cloneAssemblies(state: SimulationState): Record<string, AssemblyZoneState> {
  return Object.fromEntries(
    Object.entries(state.assemblies).map(([id, assembly]) => [
      id,
      {
        ...assembly,
        arrivedOccupantIds: [...assembly.arrivedOccupantIds],
        queuedOccupantIds: [...assembly.queuedOccupantIds],
      },
    ]),
  );
}

function decisionDelay(occupant: OccupantState): number {
  return occupant.decisionDelayTicks;
}

function injuryFor(health: number, air: number): InjuryState {
  if (health <= 0 || air <= 0) return "incapacitated";
  if (health < 40) return "serious";
  if (health < 75) return "minor";
  return "none";
}

function destinationRoom(
  connectorId: string,
  roomId: RoomId,
  scenario: ScenarioDefinition,
): RoomId | null {
  const connector = scenario.world.connectors.find((item) => item.id === connectorId);
  if (!connector) return null;
  if (connector.from === roomId) return connector.to;
  if (connector.bidirectional && connector.to === roomId) return connector.from;
  return null;
}

function targetExitAtRoom(
  occupant: OccupantState,
  roomId: RoomId,
  scenario: ScenarioDefinition,
) {
  return scenario.world.exits.find(
    (exit) => exit.roomId === roomId && (!occupant.targetExitId || exit.id === occupant.targetExitId),
  );
}

function connectorOccupancy(
  connectorId: string,
  occupantId: string,
  occupants: Record<string, OccupantState>,
): number {
  return Object.values(occupants).filter(
    (occupant) => occupant.id !== occupantId && occupant.travelConnectorId === connectorId,
  ).length;
}

function connectorCapacity(
  connectorId: string,
  scenario: ScenarioDefinition,
): number | null {
  const connector = scenario.world.connectors.find((item) => item.id === connectorId);
  return connector?.capacity ?? null;
}

function routeIsUsable(
  occupant: OccupantState,
  state: SimulationState,
  scenario: ScenarioDefinition,
): boolean {
  const connectorId = occupant.route[occupant.routeIndex];
  if (!connectorId) return true;
  const connector = scenario.world.connectors.find((item) => item.id === connectorId);
  const connectorState = state.connectors[connectorId];
  return Boolean(
    connector &&
      connectorState &&
      connectorState.status !== "blocked" &&
      (occupant.accessibility !== "accessible" || connector.accessible === true),
  );
}

function assignRoute(
  occupant: OccupantState,
  state: SimulationState,
  scenario: ScenarioDefinition,
  nextTick: number,
  events: SimulationEventDraft[],
): boolean {
  const previousRoute = occupant.route;
  const previousTarget = occupant.targetExitId;
  const route = findSafestExit(
    scenario.world,
    state.connectors,
    occupant.roomId,
    {
      accessibility: occupant.accessibility,
      smokeWeight: occupant.behavior === "panic" ? 2 : 8,
    },
  );

  if (!route.found || !route.targetExitId) {
    occupant.route = [];
    occupant.routeIndex = 0;
    occupant.targetExitId = null;
    occupant.travelConnectorId = null;
    occupant.travelTicksRemaining = 0;
    if (occupant.status !== "needs-assistance") {
      occupant.status = "needs-assistance";
      occupant.assistanceRequestedAtTick = nextTick;
      events.push(
        draft(
          {
            type: "assistance_requested",
            payload: { occupantId: occupant.id, reason: "No accessible route to an exit" },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
        ),
      );
    }
    return false;
  }

  const changed =
    previousTarget !== route.targetExitId || previousRoute.join("|") !== route.connectorIds.join("|");
  occupant.targetExitId = route.targetExitId;
  occupant.route = route.connectorIds;
  occupant.routeIndex = 0;
  occupant.status = "moving";
  occupant.lastDecisionTick = nextTick;
  if (changed) {
    events.push(
      draft(
        {
          type: previousRoute.length > 0 ? "route_changed" : "route_assigned",
          payload: {
            occupantId: occupant.id,
            targetExit: route.targetExitId,
            connectorIds: [...route.connectorIds],
          },
        },
        { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
      ),
    );
  }
  return true;
}

function tryAssembly(
  occupant: OccupantState,
  assemblies: Record<string, AssemblyZoneState>,
  scenario: ScenarioDefinition,
  nextTick: number,
  events: SimulationEventDraft[],
): boolean {
  const exit = targetExitAtRoom(occupant, occupant.roomId, scenario);
  if (!exit) return false;
  const zoneDefinition = scenario.world.assemblyZones.find((zone) => zone.id === exit.assemblyZoneId);
  const assembly = assemblies[exit.assemblyZoneId];
  if (!zoneDefinition || !assembly) return false;

  const alreadyArrived = assembly.arrivedOccupantIds.includes(occupant.id);
  if (alreadyArrived) {
    occupant.status = "assembled";
    return true;
  }

  if (zoneDefinition.capacity !== undefined && assembly.arrivedOccupantIds.length >= zoneDefinition.capacity) {
    const alreadyQueued = assembly.queuedOccupantIds.includes(occupant.id);
    if (!alreadyQueued) {
      assembly.queuedOccupantIds.push(occupant.id);
      occupant.status = "queued";
      events.push(
        draft(
          {
            type: "occupant_decision",
            payload: { occupantId: occupant.id, decision: "wait-for-assembly-capacity" },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
        ),
      );
      events.push(
        draft(
          {
            type: "congestion_observed",
            payload: {
              occupantId: occupant.id,
              waitingOccupants: assembly.arrivedOccupantIds.length + 1,
              capacity: zoneDefinition.capacity,
            },
          },
          {
            actorId: occupant.id,
            actorKind: "occupant",
            roomId: occupant.roomId,
            connectorId: `assembly:${zoneDefinition.id}`,
          },
        ),
      );
    }
    return true;
  }

  assembly.queuedOccupantIds = assembly.queuedOccupantIds.filter((id) => id !== occupant.id);
  assembly.arrivedOccupantIds.push(occupant.id);
  occupant.status = "assembled";
  if (zoneDefinition.position) occupant.position = [...zoneDefinition.position];
  occupant.assembledAtTick = nextTick;
  occupant.travelConnectorId = null;
  occupant.travelTicksRemaining = 0;
  events.push(
    draft(
      {
            type: "occupant_assembled",
            payload: {
              occupantId: occupant.id,
              assemblyZoneId: exit.assemblyZoneId,
              exitId: exit.id,
            },
      },
      { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
    ),
  );
  return true;
}

export interface OccupantStepResult {
  occupants: Record<string, OccupantState>;
  assemblies: Record<string, AssemblyZoneState>;
  events: SimulationEventDraft[];
}

export function advanceOccupants(
  state: SimulationState,
  scenario: ScenarioDefinition,
  nextTick: number,
): OccupantStepResult {
  const occupants = cloneOccupants(state);
  const assemblies = cloneAssemblies(state);
  const events: SimulationEventDraft[] = [];
  const sortedOccupants = Object.values(occupants).sort((left, right) => left.id.localeCompare(right.id));

  for (const occupant of sortedOccupants) {
    if (occupant.status === "assembled" || occupant.status === "missing") continue;

    const density = state.hazards[occupant.roomId]?.density ?? 0;
    const dt = state.clock.tickDurationSeconds;
    const previousAir = occupant.air;
    const previousHealth = occupant.health;
    const previousExposure = occupant.exposure;
    const exposure = density > 0.2 ? density : 0;
    occupant.air = Math.max(0, previousAir - exposure * AIR_DRAIN_PER_SECOND * dt);
    occupant.health = Math.max(0, previousHealth - exposure * HEALTH_DRAIN_PER_SECOND * dt);
    occupant.exposure = previousExposure + exposure * dt;

    if (exposure > 0) {
      events.push(
        draft(
          {
            type: "exposure_sampled",
            payload: {
              occupantId: occupant.id,
              roomId: occupant.roomId,
              density,
              exposure: occupant.exposure,
              air: occupant.air,
              health: occupant.health,
            },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
        ),
      );
    }

    if (previousExposure < EXPOSURE_EVENT_THRESHOLD && occupant.exposure >= EXPOSURE_EVENT_THRESHOLD) {
      events.push(
        draft(
          {
            type: "exposure_threshold_crossed",
            payload: {
              occupantId: occupant.id,
              previous: previousExposure,
              current: occupant.exposure,
            },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
        ),
      );
    }

    const previousInjury = occupant.injury;
    occupant.injury = injuryFor(occupant.health, occupant.air);
    if (previousInjury !== occupant.injury) {
      events.push(
        draft(
          {
            type: "injury_changed",
            payload: { occupantId: occupant.id, previous: previousInjury, current: occupant.injury },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
        ),
      );
    }
    if (occupant.injury === "incapacitated") {
      occupant.status = "needs-assistance";
      occupant.injuredAtTick ??= nextTick;
      if (occupant.assistanceRequestedAtTick === null) {
        occupant.assistanceRequestedAtTick = nextTick;
        events.push(
          draft(
            {
              type: "assistance_requested",
              payload: { occupantId: occupant.id, reason: "Occupant incapacitated" },
            },
            { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
          ),
        );
      }
      occupant.travelConnectorId = null;
      occupant.travelTicksRemaining = 0;
      continue;
    }
    if (occupant.injury === "serious") occupant.status = "needs-assistance";
    else if (density >= DISTRESS_DENSITY && occupant.status !== "queued") occupant.status = "distressed";
    else if (occupant.status === "distressed") occupant.status = "moving";

    if (tryAssembly(occupant, assemblies, scenario, nextTick, events)) continue;
    if (!state.incident.ignited) continue;

    if (occupant.travelConnectorId) {
      occupant.travelTicksRemaining -= 1;
      if (occupant.travelTicksRemaining > 0) continue;

      const destination = destinationRoom(
        occupant.travelConnectorId,
        occupant.roomId,
        scenario,
      );
      if (!destination) {
        occupant.status = "needs-assistance";
        continue;
      }
      occupant.roomId = destination;
      const destinationRoomDefinition = scenario.world.rooms.find((room) => room.id === destination);
      if (destinationRoomDefinition) {
        occupant.position = [
          (destinationRoomDefinition.bounds.minX + destinationRoomDefinition.bounds.maxX) / 2,
          occupant.position[1],
          (destinationRoomDefinition.bounds.minZ + destinationRoomDefinition.bounds.maxZ) / 2,
        ];
      }
      occupant.routeIndex += 1;
      occupant.travelConnectorId = null;
      occupant.travelTicksRemaining = 0;
      events.push(
        draft(
          { type: "room_entered", payload: { occupantId: occupant.id, roomId: destination } },
          { actorId: occupant.id, actorKind: "occupant", roomId: destination },
        ),
      );
      if (tryAssembly(occupant, assemblies, scenario, nextTick, events)) continue;
    }

    if (occupant.status === "needs-assistance") continue;
    if (occupant.route.length === 0 || !routeIsUsable(occupant, state, scenario)) {
      if (nextTick >= decisionDelay(occupant)) {
        events.push(
          draft(
            {
              type: "occupant_decision",
              payload: { occupantId: occupant.id, decision: "evacuate", target: occupant.behavior },
            },
            { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId },
          ),
        );
        if (!assignRoute(occupant, state, scenario, nextTick, events)) continue;
      }
    }

    const connectorId = occupant.route[occupant.routeIndex];
    if (!connectorId) continue;
    const capacity = connectorCapacity(connectorId, scenario);
    const occupancy = connectorOccupancy(connectorId, occupant.id, occupants);
    if (capacity !== null && occupancy >= capacity) {
      occupant.status = "queued";
      occupant.lastDecisionTick = nextTick;
      events.push(
        draft(
          {
            type: "occupant_decision",
            payload: {
              occupantId: occupant.id,
              decision: "wait-for-connector-capacity",
              target: connectorId,
            },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId, connectorId },
        ),
      );
      events.push(
        draft(
          {
            type: "congestion_observed",
            payload: { occupantId: occupant.id, waitingOccupants: occupancy + 1, capacity },
          },
          { actorId: occupant.id, actorKind: "occupant", roomId: occupant.roomId, connectorId },
        ),
      );
      continue;
    }

    const connector = scenario.world.connectors.find((item) => item.id === connectorId);
    if (!connector) {
      occupant.status = "needs-assistance";
      continue;
    }
    occupant.travelConnectorId = connectorId;
    occupant.travelTicksRemaining = Math.max(
      1,
      (connector.travelTicks ?? 1) + (occupant.mobility === "assisted" ? 1 : 0),
    );
  }

  return { occupants, assemblies, events };
}
