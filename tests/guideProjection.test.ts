import assert from "node:assert/strict";
import {
  buildGuideProjection,
  buildSimulationSnapshot,
  createInitialSimulationState,
  createLiveScenario,
  startSimulation,
} from "../app/simulation/core";

console.log("----------------------------------------");
console.log("Running Guide Tactical Projection Tests");
console.log("----------------------------------------\n");

console.log("Test 1: Verifying the compact tactical projection covers the full authored block...");
const scenario = createLiveScenario(17);
const initial = startSimulation(createInitialSimulationState(scenario, "run-guide"));
const snapshot = buildSimulationSnapshot(initial, scenario);
const projection = buildGuideProjection(snapshot, {
  position: [0, 1, 0, 0],
  sectorId: "lobby",
});
assert.equal(projection.rooms.length, 8);
assert.equal(projection.connectors.length, 9);
assert.equal(projection.occupants.length, 2);
assert(projection.occupants.some((occupant) => occupant.id === "maya" && occupant.roomId === "vault"));
assert(projection.recommendation?.found);
assert.equal(projection.navigator?.sectorId, "lobby");
console.log("✓ All compact rooms, connectors, occupants, and a measured route recommendation are exposed.");

console.log("\nTest 2: Verifying recommendation changes around a blocked connector...");
const blockedSnapshot = {
  ...snapshot,
  connectors: {
    ...snapshot.connectors,
    "entry-lobby": {
      ...snapshot.connectors["entry-lobby"],
      status: "blocked" as const,
      reason: "Smoke",
    },
  },
};
const rerouted = buildGuideProjection(blockedSnapshot, {
  position: [0, 1, 0, 0],
  sectorId: "lobby",
});
assert(rerouted.recommendation?.found);
assert.equal(rerouted.recommendation.targetExitId, "west-exit");
assert(!rerouted.recommendation.connectorIds.includes("entry-lobby"));
console.log("✓ The displayed recommendation follows the current connector state instead of a hardcoded route.");

console.log("\n========================================");
console.log("All Guide tactical projection tests passed cleanly!");
console.log("========================================");
