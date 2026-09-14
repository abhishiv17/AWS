import assert from "node:assert/strict";
import {
  createInitialHazardState,
  stepHazardSimulation,
  classifyHazard,
  calculateAirDrainRate,
  classificationToEdgeStatus,
  createHazardSnapshot,
  DEFAULT_HAZARD_CONFIG,
} from "../app/simulation/hazard";
import { NAV_EDGES, findSafestExit, type NavigationEdge } from "../app/simulation/nav";
import type { Vec3 } from "../app/simulation/level";

console.log("----------------------------------------");
console.log("Running CampusEvac Dynamic Hazard Tests ");
console.log("----------------------------------------\n");

// Test 1: Defined Fire Origin & Pre-Ignition Safety
console.log("Test 1: Verifying fire origin in Lab 202...");
let state = createInitialHazardState();
assert.equal(state.ignited, false, "Hazard state must be unignited at t=0");
assert.equal(state.sectorSmoke["lab-202"], 0, "Lab 202 must be clear at t=0");
assert.equal(state.sectorSmoke["classroom-204"], 0, "Classroom 204 must be clear at t=0");

// Step forward 10 seconds (before 15s ignition)
for (let i = 0; i < 50; i++) {
  state = stepHazardSimulation(state, 0.2);
}
assert.equal(state.ignited, false, "Drill at t=10s must remain unignited");
assert.equal(state.sectorSmoke["lab-202"], 0, "Lab 202 must remain 0 before ignition delay");

// Step forward past 15s
for (let i = 0; i < 30; i++) {
  state = stepHazardSimulation(state, 0.2);
}
assert.equal(state.ignited, true, "Fire must be ignited past 15 seconds");
assert(state.sectorSmoke["lab-202"] > 0, "Smoke generation must begin in Lab 202");
console.log(`✓ Ignition confirmed at t=${state.elapsedSeconds.toFixed(1)}s in origin: ${DEFAULT_HAZARD_CONFIG.originRoom}`);
console.log(`  Lab 202 smoke density: ${state.sectorSmoke["lab-202"].toFixed(3)}`);

// Test 2: Connected Space Propagation & Adjacency Transfer
console.log("\nTest 2: Verifying differential smoke propagation along connected spaces...");
// Simulate forward for 40 seconds of smoke spread
for (let i = 0; i < 200; i++) {
  state = stepHazardSimulation(state, 0.2);
}
// Smoke in Lab 202 should be highest, followed by adjacent spaces
assert(state.sectorSmoke["lab-202"] > 0.4, "Lab 202 must have accumulated significant smoke");
assert(state.sectorSmoke["junction-center"] > 0, "Smoke must transfer to adjacent Central Junction");
assert(state.sectorSmoke["chem-store"] > 0, "Smoke must transfer to adjacent Chemical Store");
assert(
  state.sectorSmoke["corridor-east"] > state.sectorSmoke["corridor-west"],
  "East corridor must have higher smoke than West corridor due to thermal draft",
);
assert(
  state.sectorSmoke["stair-west"] < 0.05,
  "West stairwell must remain protected and clear",
);
console.log("✓ Connected propagation verified:");
console.log(`  Lab 202 (Origin): ${state.sectorSmoke["lab-202"].toFixed(3)}`);
console.log(`  Central Junction: ${state.sectorSmoke["junction-center"].toFixed(3)}`);
console.log(`  Corridor East:    ${state.sectorSmoke["corridor-east"].toFixed(3)}`);
console.log(`  Corridor West:    ${state.sectorSmoke["corridor-west"].toFixed(3)} (protected)`);
console.log(`  West Stairwell:   ${state.sectorSmoke["stair-west"].toFixed(3)} (safe)`);

// Test 3: Four-Stage Route Classification Transitions
console.log("\nTest 3: Validating 4-stage route transitions (CLEAR -> CAUTION -> DANGEROUS -> BLOCKED)...");
assert.equal(classifyHazard(0.05), "CLEAR");
assert.equal(classifyHazard(0.25), "CAUTION");
assert.equal(classifyHazard(0.55), "DANGEROUS");
assert.equal(classifyHazard(0.75), "BLOCKED");

// Check status mapping
assert.equal(classificationToEdgeStatus("CLEAR"), "open");
assert.equal(classificationToEdgeStatus("CAUTION"), "open");
assert.equal(classificationToEdgeStatus("DANGEROUS"), "compromised");
assert.equal(classificationToEdgeStatus("BLOCKED"), "blocked");
console.log("✓ 4-stage route classification and edge status mappings verified.");

// Test 4: Dynamic A* Rerouting When East Route Reaches BLOCKED
console.log("\nTest 4: Verifying automatic A* rerouting when East Route crosses BLOCKED threshold...");
// Continue simulation until East Stair / Corridor accumulates to DANGEROUS / BLOCKED
while ((state.sectorSmoke["stair-east"] < 0.70 && state.sectorSmoke["corridor-east"] < 0.70) && state.elapsedSeconds < 250) {
  state = stepHazardSimulation(state, 0.2);
}
console.log(`  State at t=${state.elapsedSeconds.toFixed(1)}s:`, state.sectorSmoke);
assert(state.edgeSmoke["edge-corre-staire-entry"] >= 0.70, "East route entry edge must reach BLOCKED threshold (S >= 0.70)");
assert.equal(classifyHazard(state.edgeSmoke["edge-corre-staire-entry"]), "BLOCKED");

// Build dynamic edge state from simulation
const dynamicEdges: Record<string, NavigationEdge> = {};
for (const defaultEdge of NAV_EDGES) {
  const density = state.edgeSmoke[defaultEdge.id] ?? defaultEdge.smokeDensity;
  const classification = classifyHazard(density);
  const status = classificationToEdgeStatus(classification, defaultEdge);
  dynamicEdges[defaultEdge.id] = {
    ...defaultEdge,
    smokeDensity: density,
    status,
  };
}

// Verify East edges are now dynamically BLOCKED without hardcoded timers
assert.equal(dynamicEdges["edge-corre-staire-entry"].status, "blocked");

// Now run A* from Central Junction [0, 0, 0]
const junctionPos: Vec3 = [0, 1.1, 0];
const routingResult = findSafestExit(junctionPos, dynamicEdges);
assert(routingResult.path.found, "A* must find an egress route");
assert.equal(
  routingResult.target,
  "assembly-a",
  "A* must dynamically divert to West Exit A when East is blocked",
);
assert(
  !routingResult.path.edges.some((e) => e.id === "edge-corre-staire-entry"),
  "A* path must not contain blocked East Stairwell edges",
);
console.log(`✓ East Stairwell dynamically BLOCKED at S=${state.sectorSmoke["stair-east"].toFixed(3)} (t=${state.elapsedSeconds.toFixed(1)}s)`);
console.log(`✓ A* pathfinder automatically rerouted to ${routingResult.target} via West Stairwell`);

// Test 5: Air Quality Exposure Curves
console.log("\nTest 5: Verifying physiological air degradation rates...");
assert.equal(calculateAirDrainRate(0.05), 0.0, "Clear air must have 0% air drain");
assert(calculateAirDrainRate(0.30) > 0.4 && calculateAirDrainRate(0.30) < 1.0, "Caution air must cause mild drain");
assert.equal(calculateAirDrainRate(0.55), 2.8, "Dangerous air must drain at 2.8%/sec");
assert.equal(calculateAirDrainRate(0.85), 6.5, "Blocked toxic air must drain at 6.5%/sec");
console.log("✓ Air quality degradation rates correctly scale with local smoke exposure.");

// Test 6: Ventilation Override Mitigation
console.log("\nTest 6: Validating ventilation intervention mitigation...");
let unventilatedState = createInitialHazardState();
let ventilatedState = createInitialHazardState();

// Run both for 60 seconds post-ignition
for (let i = 0; i < 300; i++) {
  unventilatedState = stepHazardSimulation(unventilatedState, 0.2, false);
  ventilatedState = stepHazardSimulation(ventilatedState, 0.2, true);
}
assert(
  ventilatedState.sectorSmoke["lab-202"] < unventilatedState.sectorSmoke["lab-202"] * 0.5,
  "Ventilated state must have significantly lower smoke density than unventilated",
);
console.log(`✓ Unventilated Lab 202: ${unventilatedState.sectorSmoke["lab-202"].toFixed(3)}`);
console.log(`✓ Ventilated Lab 202:   ${ventilatedState.sectorSmoke["lab-202"].toFixed(3)} (over 50% reduction)`);

// Test 7: Guide Telemetry Snapshot
console.log("\nTest 7: Verifying Guide telemetry snapshot generation...");
const snapshot = createHazardSnapshot(state);
assert.equal(snapshot.originRoom, "lab-202");
assert.equal(snapshot.ignited, true);
assert(snapshot.sectorReadings.length >= 12, "Snapshot must include all 12 rooms");
assert(snapshot.edgeHeatmap.length >= 18, "Snapshot must include all graph edges");
console.log(`✓ Snapshot generated with ${snapshot.sectorReadings.length} sector readings and ${snapshot.edgeHeatmap.length} edge heatmap entries.`);

console.log("\n========================================");
console.log("All Dynamic Hazard tests passed cleanly!");
console.log("========================================");
