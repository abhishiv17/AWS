import assert from "node:assert/strict";
import {
  createInitialMayaState,
  transitionMaya,
  stepMayaAgent,
} from "../app/simulation/maya";
import {
  NAV_EDGES,
  type NavigationEdge,
} from "../app/simulation/nav";
import { MAYA_SPAWN, type Vec3 } from "../app/simulation/level";

console.log("----------------------------------------");
console.log("Running CampusEvac Maya System Tests    ");
console.log("----------------------------------------\n");

// Test 1: Deterministic Spawn
console.log("Test 1: Verifying deterministic spawn in Classroom 205...");
const mayaInitial = createInitialMayaState();
assert.equal(mayaInitial.status, "CALM", "Maya must start in CALM state");
assert.deepEqual(mayaInitial.position, MAYA_SPAWN, "Maya must spawn at MAYA_SPAWN [15, 1.0, -6]");
assert.equal(mayaInitial.sectorId, "classroom-205", "Maya must start in Classroom 205");
assert.equal(mayaInitial.health, 100, "Maya initial health must be 100");
assert.equal(mayaInitial.air, 100, "Maya initial air must be 100");
console.log(`✓ Maya spawned at [${mayaInitial.position.join(", ")}] in sector: ${mayaInitial.sectorId}`);

// Test 2: Explicit State Machine Progression
console.log("\nTest 2: Verifying state machine transitions (CALM -> ALARMED -> WAITING_FOR_HELP -> FOLLOWING)...");
const context = {
  elapsedSeconds: 16.0,
  playerPos: [-15, 1.1, -6] as Vec3, // Player far away in Classroom 204
  localSmoke: 0,
};

// 2a. Alarm sounds
let state = transitionMaya(mayaInitial, { type: "alarm" }, context);
assert.equal(state.status, "ALARMED", "Alarm event must transition Maya to ALARMED");
assert(state.dialogue?.includes("alarm"), "Maya dialogue must react to alarm");

// 2b. Player approaches
state = transitionMaya(
  state,
  { type: "player_approached", distance: 2.5 },
  { ...context, playerPos: [14, 1.1, -6] },
);
assert.equal(state.status, "WAITING_FOR_HELP", "Proximity approach must transition Maya to WAITING_FOR_HELP");
assert(state.dialogue?.includes("help"), "Maya dialogue must request assistance");

// 2c. Player assists
state = transitionMaya(
  state,
  { type: "assisted" },
  { ...context, elapsedSeconds: 20.0 },
);
assert.equal(state.status, "FOLLOWING", "Assist action must transition Maya to FOLLOWING");
assert.equal(state.assistedAt, 20.0, "Assisted timestamp must be recorded");
console.log(`✓ State progression verified: CALM -> ALARMED -> WAITING_FOR_HELP -> FOLLOWING`);
console.log(`  Maya dialogue: "${state.dialogue}"`);

// Test 3: Navigation Graph Consumption & Waypoint Following
console.log("\nTest 3: Verifying Navigation Graph pathfinding and waypoint steering...");
const defaultEdgesRecord: Record<string, NavigationEdge> = Object.fromEntries(
  NAV_EDGES.map((e) => [e.id, e]),
);

// Initial step to populate path
const playerNearby: Vec3 = [14.5, 1.1, -5.0];
const stepResult = stepMayaAgent(
  state,
  0.5,
  playerNearby,
  defaultEdgesRecord,
  21.0,
);
state = stepResult.nextState;

assert(state.assignedPath.length > 0, "Maya must compute an assigned path along the navigation graph");
assert.equal(state.assignedPath[0].id, "node-c205", "Path must begin at node-c205");
assert.equal(state.assignedPath[1].id, "node-d-c205", "First corridor waypoint must be Door 205");
console.log(`✓ Maya calculated path with ${state.assignedPath.length} nodes using Navigation Graph.`);
console.log(`  Initial waypoints: ${state.assignedPath.slice(0, 4).map((n) => n.label).join(" -> ")}`);

// Test 4: Dynamic Hazard Reaction & Safe A* Rerouting
console.log("\nTest 4: Verifying hazard detection & dynamic rerouting around dangerous edges...");
// Move Maya to East corridor junction
state.position = [15, 1.1, 0];
state.sectorId = "corridor-east";

// Create blocked East route edges
const blockedEdges: Record<string, NavigationEdge> = {
  ...defaultEdgesRecord,
  "edge-corre-staire-entry": {
    ...defaultEdgesRecord["edge-corre-staire-entry"],
    status: "blocked",
    smokeDensity: 0.85,
  },
  "edge-staire-entry-landing": {
    ...defaultEdgesRecord["edge-staire-entry-landing"],
    status: "blocked",
    smokeDensity: 0.85,
  },
};

// Re-tick Maya agent with blocked East route
const rerouteStep = stepMayaAgent(
  state,
  0.5,
  [12, 1.1, 0], // player moving toward Central Junction
  blockedEdges,
  45.0,
);
state = rerouteStep.nextState;

assert.equal(
  state.targetExit,
  "assembly-a",
  "Maya must dynamically reroute to Assembly Area A (West) when East is blocked",
);
assert(
  !state.assignedPath.some((node) => node.id.includes("staire")),
  "Maya's rerouted path must not traverse the blocked East stairwell",
);
console.log(`✓ East Stairwell blockage detected: Maya diverted to target exit: ${state.targetExit}`);

// Test 5: Smoke Distress & Speed Degradation
console.log("\nTest 5: Verifying physiological smoke distress reaction & slowdown...");
state = transitionMaya(
  state,
  { type: "smoke_increased", density: 0.60 },
  { elapsedSeconds: 50.0, playerPos: state.position, localSmoke: 0.60 },
);
assert.equal(state.status, "DISTRESSED", "High smoke density must transition Maya to DISTRESSED");
assert(state.dialogue?.includes("cough") || state.dialogue?.includes("breathe"), "Maya dialogue must reflect coughing");
console.log(`✓ Smoke distress verified: Maya status is ${state.status} with dialogue: "${state.dialogue}"`);

// Test 6: Abandonment Logging
console.log("\nTest 6: Verifying abandonment event recording...");
const abandonedState = transitionMaya(
  state,
  { type: "abandoned" },
  { elapsedSeconds: 65.0, playerPos: [0, 1.1, 0], localSmoke: 0.1 },
);
assert.equal(abandonedState.status, "ABANDONED", "Abandonment must set status to ABANDONED");
assert.equal(abandonedState.abandonedAt, 65.0, "Abandonment timestamp must be recorded");
console.log(`✓ Abandonment event recorded at t=${abandonedState.abandonedAt}s`);

// Test 7: Safe Muster Evacuation
console.log("\nTest 7: Verifying safe evacuation arrival at muster beacon...");
// Move Maya to West Assembly Area A
state.position = [-19, 0, 19];
const rescueStep = stepMayaAgent(
  state,
  0.5,
  [-19.5, 0, 19],
  defaultEdgesRecord,
  75.0,
);
state = rescueStep.nextState;

assert.equal(state.status, "SAFE", "Arriving at assembly beacon must transition Maya to SAFE");
assert.equal(state.targetExit, "assembly-a", "Target exit must record assembly-a");
assert.equal(state.safeAt, 75.0, "Safe evacuation timestamp must be recorded");
assert(state.dialogue?.includes("safe"), "Maya dialogue must express gratitude upon safe muster");
console.log(`✓ Rescue confirmed: Maya is SAFE at ${state.targetExit} (t=${state.safeAt}s)`);
console.log(`  Final dialogue: "${state.dialogue}"`);

console.log("\n========================================");
console.log("All Maya System tests passed cleanly!   ");
console.log("========================================");
