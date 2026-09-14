import assert from "node:assert/strict";
import type { Vec3 } from "../app/simulation/level";
import {
  NAV_NODES,
  NAV_EDGES,
  findNearestNode,
  findSafestExit,
  calculateEdgeCost,
  type NavigationEdge,
} from "../app/simulation/nav";

console.log("----------------------------------------");
console.log("Running CampusEvac Navigation Graph Tests");
console.log("----------------------------------------\n");

// Test 1: Node and Edge Counts
console.log("Test 1: Verifying graph entity counts...");
assert(NAV_NODES.length >= 16, `Expected at least 16 nodes, found ${NAV_NODES.length}`);
assert(NAV_EDGES.length >= 18, `Expected at least 18 edges, found ${NAV_EDGES.length}`);
console.log(`✓ Graph loaded with ${NAV_NODES.length} nodes and ${NAV_EDGES.length} edges.`);

// Test 2: Nearest Node Localization
console.log("\nTest 2: Verifying nearest node projection...");
const spawnPos: Vec3 = [-15, 1.1, -6];
const nearestToSpawn = findNearestNode(spawnPos);
assert.equal(nearestToSpawn.id, "node-c204", "Nearest node to evacuee spawn must be node-c204");
console.log(`✓ Position ${JSON.stringify(spawnPos)} correctly maps to ${nearestToSpawn.label} (${nearestToSpawn.id}).`);

// Test 3: Baseline Egress from Classroom 204
console.log("\nTest 3: Computing baseline optimal egress from Classroom 204...");
const baselineResult = findSafestExit(spawnPos);
assert(baselineResult.path.found, "Must find a viable egress path under normal conditions");
assert.equal(baselineResult.target, "assembly-a", "Classroom 204 should recommend Exit A (West Courtyard)");
assert.equal(baselineResult.path.safetyRating, "safe", "Initial path should be rated safe");
console.log(`✓ Baseline exit: ${baselineResult.target}`);
console.log(`  Path distance: ${baselineResult.path.totalDistance.toFixed(1)}m`);
console.log(`  Waypoints: ${baselineResult.path.nodes.map((n) => n.label).join(" -> ")}`);

// Test 4: Dynamic Rerouting around Blocked West Exit
console.log("\nTest 4: Simulating blockage of West Stairwell...");
const blockedWestEdges: Record<string, NavigationEdge> = {};
for (const edge of NAV_EDGES) {
  if (edge.id === "edge-stairw-entry-landing" || edge.id === "edge-stairw-landing-exita") {
    blockedWestEdges[edge.id] = { ...edge, status: "blocked" };
  }
}
const reroutedResult = findSafestExit(spawnPos, blockedWestEdges);
assert(reroutedResult.path.found, "Must find alternate route when West exit is blocked");
assert.equal(reroutedResult.target, "assembly-b", "Should dynamically reroute to East Exit B / Assembly B");
assert(
  reroutedResult.path.nodes.some((n) => n.id === "node-junction"),
  "Rerouted path must traverse through Central Junction",
);
console.log(`✓ Dynamic reroute succeeded: diverted to ${reroutedResult.target}`);
console.log(`  New distance: ${reroutedResult.path.totalDistance.toFixed(1)}m`);
console.log(`  Rerouted waypoints: ${reroutedResult.path.nodes.map((n) => n.label).join(" -> ")}`);

// Test 5: Smoke Cost Calculation
console.log("\nTest 5: Validating quadratic smoke penalty formula...");
const clearEdge: NavigationEdge = {
  id: "test-edge",
  fromNode: "node-1",
  toNode: "node-2",
  baseDistance: 10.0,
  clearWidth: 2.0,
  status: "open",
  smokeDensity: 0.0,
  isEmergencyExit: false,
};
const clearCost = calculateEdgeCost(clearEdge);
assert.equal(clearCost, 10.0, "Cost of clear edge should equal its metric length (10.0)");

const smokyEdge: NavigationEdge = {
  ...clearEdge,
  smokeDensity: 0.5, // 1.0 + 8.0 * (0.5^2) = 1.0 + 2.0 = 3.0x multiplier
};
const smokyCost = calculateEdgeCost(smokyEdge);
assert.equal(smokyCost, 30.0, "Cost of smoky edge (S=0.5) should be 3.0x length (30.0)");
console.log(`✓ Clear cost (10m): ${clearCost}, Smoky cost (S=0.5): ${smokyCost} (exactly 3.0x penalty)`);

// Test 6: Catastrophic All-Exit Severance Handling
console.log("\nTest 6: Handling catastrophic full-blockage scenario...");
const allBlockedEdges: Record<string, NavigationEdge> = {};
for (const edge of NAV_EDGES) {
  if (edge.isEmergencyExit) {
    allBlockedEdges[edge.id] = { ...edge, status: "blocked" };
  }
}
const noExitResult = findSafestExit(spawnPos, allBlockedEdges);
assert.equal(noExitResult.path.found, false, "Path found should be false when all exits are blocked");
assert.equal(noExitResult.path.safetyRating, "critical", "Safety rating must be critical");
console.log("✓ Gracefully handled zero-path scenario without crashing.");

console.log("\n========================================");
console.log("All Navigation Graph tests passed cleanly!");
console.log("========================================");
