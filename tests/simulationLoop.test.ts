import assert from "node:assert/strict";
import {
  createFoundationScenario,
  createLiveScenario,
  createInitialSimulationState,
  buildSimulationReport,
  deriveSimulationMetrics,
  findSafestExit,
  startSimulation,
  stepSimulation,
  buildSimulationSnapshot,
  type ConnectorState,
  type ScenarioDefinition,
} from "../app/simulation/core";

console.log("----------------------------------------");
console.log("Running CampusEvac Simulation Loop Tests");
console.log("----------------------------------------\n");

function scenarioWithOccupants(capacity?: number): ScenarioDefinition {
  const base = createFoundationScenario(23);
  return {
    ...base,
    durationSeconds: 20,
    world: {
      ...base.world,
      assemblyZones: base.world.assemblyZones.map((zone) => ({ ...zone, capacity })),
    },
    incident: {
      ...base.incident,
      ignitionDelaySeconds: 0,
      generationRate: 0,
      dissipationRate: 0,
    },
    occupants: [
      {
        id: "calm-occupant",
        profile: "student",
        spawnRoomId: "lobby",
        spawnPosition: [0, 1, 0],
        mobility: "independent",
        behavior: "calm",
      },
      {
        id: "hesitant-occupant",
        profile: "visitor",
        spawnRoomId: "lobby",
        spawnPosition: [0, 1, 1],
        mobility: "independent",
        behavior: "hesitant",
        decisionDelayTicks: 3,
      },
    ],
  };
}

console.log("Test 1: Verifying ignition, propagation, and dynamic connector status...");
const hazardScenario = {
  ...createFoundationScenario(11),
  incident: {
    ...createFoundationScenario(11).incident,
    ignitionDelaySeconds: 0,
    generationRate: 1,
    dissipationRate: 0,
  },
};
let hazardState = startSimulation(createInitialSimulationState(hazardScenario, "run-hazard"));
hazardState = stepSimulation(hazardState, hazardScenario, 12);
assert(hazardState.incident.ignited, "Incident must ignite after its delay");
assert(hazardState.hazards.sec.density > 0, "Origin room must accumulate smoke");
assert(hazardState.hazards.wcorr.density > 0, "Smoke must propagate across the west connector");
assert.equal(hazardState.connectors["wcorr-sec"].status, "blocked");
assert(hazardState.eventLog.events.some((event) => event.type === "fire_ignited"));
assert(hazardState.eventLog.events.some((event) => event.type === "connector_status_changed"));
console.log("✓ Incident state, propagation, thresholds, and dynamic edge status are recorded.");

console.log("\nTest 2: Verifying safer-route selection around blocked connectors...");
const routingScenario = createFoundationScenario(12);
const routingState = createInitialSimulationState(routingScenario, "run-routing");
const blockedConnectors: Record<string, ConnectorState> = {
  ...routingState.connectors,
  "entry-lobby": { ...routingState.connectors["entry-lobby"], status: "blocked", reason: "Smoke" },
  "lobby-ecorr": { ...routingState.connectors["lobby-ecorr"], status: "blocked", reason: "Smoke" },
};
const rerouted = findSafestExit(routingScenario.world, blockedConnectors, "lobby");
assert(rerouted.found, "A west alternate route must remain available");
assert.equal(rerouted.targetExitId, "west-exit");
assert(!rerouted.connectorIds.includes("entry-lobby"));
console.log(`✓ Blocked connectors reroute the occupant to ${rerouted.targetExitId}.`);

console.log("\nTest 3: Verifying behavior delay, movement, assembly capacity, and accountability...");
const capacityScenario = scenarioWithOccupants(1);
let capacityState = startSimulation(createInitialSimulationState(capacityScenario, "run-capacity"));
capacityState = stepSimulation(capacityState, capacityScenario, 4);
assert.equal(capacityState.occupants["calm-occupant"].status, "assembled");
assert.equal(capacityState.occupants["hesitant-occupant"].status, "queued");
assert.deepEqual(capacityState.assemblies["outdoor-assembly"].arrivedOccupantIds, ["calm-occupant"]);
assert.deepEqual(capacityState.assemblies["outdoor-assembly"].queuedOccupantIds, ["hesitant-occupant"]);
assert(capacityState.eventLog.events.some((event) => event.type === "occupant_decision"));
assert(capacityState.eventLog.events.some((event) => event.type === "occupant_assembled"));
const capacityMetrics = deriveSimulationMetrics(capacityState);
assert.equal(capacityMetrics.totalOccupants.value, 2);
assert.deepEqual(capacityMetrics.assembledOccupants.eventSequences.length, 1);
assert(capacityMetrics.totalOccupants.eventSequences.every((sequence) => sequence > 0));
const capacityReport = buildSimulationReport(capacityState, capacityScenario);
assert.equal(capacityReport.metrics.exitUtilization["main-exit"].assembledCount, 1);
assert(capacityReport.findings.some((finding) => finding.id === "bottleneck-assembly:outdoor-assembly"));
assert(capacityReport.findings.every((finding) => finding.eventSequences.every((sequence) => sequence > 0)));
console.log("✓ Hesitation, assembly capacity, queueing, and accountability events are deterministic.");

console.log("\nTest 4: Verifying accessibility filtering and injury assistance...");
const inaccessibleRoute = findSafestExit(
  capacityScenario.world,
  capacityState.connectors,
  "lobby",
  { accessibility: "accessible" },
);
assert.equal(inaccessibleRoute.found, false, "Unverified accessibility must not be assumed");

const injuryScenario: ScenarioDefinition = {
  ...createFoundationScenario(31),
  durationSeconds: 100,
  incident: {
    ...createFoundationScenario(31).incident,
    originRoomId: "lobby",
    ignitionDelaySeconds: 0,
    generationRate: 10,
    dissipationRate: 0,
  },
  occupants: [
    {
      id: "trapped-occupant",
      profile: "visitor",
      spawnRoomId: "lobby",
      spawnPosition: [0, 1, 0],
      mobility: "assisted",
      accessibility: "accessible",
      behavior: "hesitant",
    },
  ],
};
let injuryState = startSimulation(createInitialSimulationState(injuryScenario, "run-injury"));
injuryState = {
  ...injuryState,
  clock: { ...injuryState.clock, tickDurationSeconds: 1 },
};
injuryState = stepSimulation(injuryState, injuryScenario, 45);
assert.equal(injuryState.occupants["trapped-occupant"].injury, "incapacitated");
assert.equal(injuryState.occupants["trapped-occupant"].status, "needs-assistance");
assert(injuryState.eventLog.events.some((event) => event.type === "injury_changed"));
assert(injuryState.eventLog.events.some((event) => event.type === "assistance_requested"));
console.log("✓ Accessibility constraints produce assistance needs and auditable injury transitions.");

console.log("\nTest 5: Verifying the active live scenario emits hazard and occupant evidence...");
const liveScenario = createLiveScenario(41);
let liveState = startSimulation(createInitialSimulationState(liveScenario, "run-live"));
liveState = stepSimulation(liveState, liveScenario, 160);
assert(liveState.incident.ignited, "Live incident must ignite on the core clock");
assert.equal(Object.keys(liveState.occupants).length, 2);
assert(liveState.eventLog.events.some((event) => event.type === "occupant_spawned"));
assert(liveState.eventLog.events.some((event) => event.type === "route_assigned"));
const liveSnapshot = buildSimulationSnapshot(liveState, liveScenario);
assert.equal(liveSnapshot.report.metrics.totalOccupants.value, 2);
assert(liveSnapshot.report.metrics.eventCount > 0);
console.log("✓ Live compact scenario produces deterministic incident, occupant, route, and report evidence.");

console.log("\n========================================");
console.log("All Simulation Loop tests passed cleanly!");
console.log("========================================");
