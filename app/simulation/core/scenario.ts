import { createCompactWorld, validateWorld } from "./world";
import type { ScenarioDefinition } from "./types";

export const FOUNDATION_SCENARIO_ID = "compact-foundation";
export const FOUNDATION_SCENARIO_VERSION = "compact-foundation-v1";
export const LIVE_SCENARIO_ID = "compact-live";
export const LIVE_SCENARIO_VERSION = "compact-live-v1";

export function createFoundationScenario(seed = 1): ScenarioDefinition {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error("Foundation scenario seed must be a finite integer");
  }

  return {
    id: FOUNDATION_SCENARIO_ID,
    version: FOUNDATION_SCENARIO_VERSION,
    seed,
    world: createCompactWorld(),
    incident: {
      // Existing prototype defaults; these are not physical measurements.
      originRoomId: "sec",
      ignitionDelaySeconds: 15,
      generationRate: 0.08,
      dissipationRate: 0.005,
      ventilationFactor: 0.2,
    },
    occupants: [],
  };
}

/** The active drill scenario keeps the foundation model and adds deterministic peers. */
export function createLiveScenario(seed = 1): ScenarioDefinition {
  const foundation = createFoundationScenario(seed);
  return {
    ...foundation,
    id: LIVE_SCENARIO_ID,
    version: LIVE_SCENARIO_VERSION,
    durationSeconds: 180,
    world: {
      ...foundation.world,
      connectors: foundation.world.connectors.map((connector) => ({
        ...connector,
        travelTicks:
          connector.id === "vault-annex"
            ? 8
            : connector.id === "entry-outside"
              ? 4
              : 12,
      })),
    },
    occupants: [
      {
        id: "maya",
        profile: "vulnerable-peer",
        spawnRoomId: "vault",
        spawnPosition: [15, 1, 0],
        mobility: "assisted",
        behavior: "hesitant",
        decisionDelayTicks: 18,
      },
      {
        id: "lab-occupant",
        profile: "lab-occupant",
        spawnRoomId: "sec",
        spawnPosition: [-15, 1, 0],
        mobility: "independent",
        behavior: "calm",
        decisionDelayTicks: 6,
      },
    ],
  };
}

export function validateScenario(scenario: ScenarioDefinition): string[] {
  const errors = validateWorld(scenario.world);
  const roomIds = new Set(scenario.world.rooms.map((room) => room.id));
  const occupantIds = new Set<string>();

  if (!Number.isFinite(scenario.seed) || !Number.isInteger(scenario.seed)) {
    errors.push("Scenario seed must be a finite integer");
  }
  if (!roomIds.has(scenario.incident.originRoomId)) {
    errors.push(`Unknown incident origin room: ${scenario.incident.originRoomId}`);
  }
  if (
    !Number.isFinite(scenario.incident.ignitionDelaySeconds) ||
    scenario.incident.ignitionDelaySeconds < 0
  ) {
    errors.push("Incident ignition delay must be a non-negative finite number");
  }
  if (!Number.isFinite(scenario.incident.generationRate) || scenario.incident.generationRate < 0) {
    errors.push("Incident generation rate must be a non-negative finite number");
  }
  if (!Number.isFinite(scenario.incident.dissipationRate) || scenario.incident.dissipationRate < 0) {
    errors.push("Incident dissipation rate must be a non-negative finite number");
  }
  if (
    !Number.isFinite(scenario.incident.ventilationFactor) ||
    scenario.incident.ventilationFactor < 0 ||
    scenario.incident.ventilationFactor > 1
  ) {
    errors.push("Incident ventilation factor must be between zero and one");
  }
  if (scenario.durationSeconds !== undefined && scenario.durationSeconds <= 0) {
    errors.push("Scenario duration must be positive");
  }

  for (const occupant of scenario.occupants) {
    if (occupantIds.has(occupant.id)) errors.push(`Duplicate occupant: ${occupant.id}`);
    if (!roomIds.has(occupant.spawnRoomId)) {
      errors.push(`Unknown occupant spawn room: ${occupant.spawnRoomId}`);
    }
    occupantIds.add(occupant.id);
  }

  return errors;
}
