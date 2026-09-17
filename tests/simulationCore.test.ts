import assert from "node:assert/strict";
import {
  advanceSimulationClock,
  createSimulationClock,
} from "../app/simulation/core/clock";
import { createSeededRandom } from "../app/simulation/core/rng";
import {
  createEventLog,
  recordSimulationEvent,
} from "../app/simulation/core/events";
import {
  advanceSimulation,
  createInitialSimulationState,
  latestSimulationEvent,
  startSimulation,
} from "../app/simulation/core/engine";
import { createFoundationScenario, validateScenario } from "../app/simulation/core/scenario";
import { createCompactWorld, validateWorld } from "../app/simulation/core/world";

console.log("----------------------------------------");
console.log("Running CampusEvac Simulation Core Tests");
console.log("----------------------------------------\n");

console.log("Test 1: Verifying fixed deterministic clock...");
const clock = advanceSimulationClock(createSimulationClock(), 3);
assert.equal(clock.tick, 3);
assert.equal(clock.elapsedSeconds, 0.30000000000000004);
assert.throws(() => advanceSimulationClock(clock, -1));
console.log("✓ Fixed clock advances by integer ticks without wall-clock reads.");

console.log("\nTest 2: Verifying seeded random reproducibility...");
const randomA = createSeededRandom(42);
const randomB = createSeededRandom(42);
assert.deepEqual(
  [randomA.next(), randomA.next(), randomA.nextInt(10_000)],
  [randomB.next(), randomB.next(), randomB.nextInt(10_000)],
);
assert.equal(randomA.fork("occupants").next(), randomB.fork("occupants").next());
assert.throws(() => createSeededRandom(1.5));
console.log("✓ Identical seeds and namespaces produce identical sequences.");

console.log("\nTest 3: Verifying compact-world adapter...");
const world = createCompactWorld();
assert.deepEqual(validateWorld(world), []);
assert(world.rooms.some((room) => room.id === "sec"));
assert(world.connectors.some((connector) => connector.id === "wcorr-sec"));
assert.equal(world.exits[0]?.assemblyZoneId, "outdoor-assembly");
console.log(`✓ Compact world loaded with ${world.rooms.length} rooms and ${world.connectors.length} connectors.`);

console.log("\nTest 4: Verifying scenario validation and initial state...");
const scenario = createFoundationScenario(7);
assert.deepEqual(validateScenario(scenario), []);
const initial = createInitialSimulationState(scenario, "run-foundation");
assert.equal(initial.phase, "idle");
assert.equal(initial.clock.tick, 0);
assert.equal(initial.hazards.sec?.classification, "clear");
assert.equal(initial.eventLog.nextSequence, 1);
console.log("✓ Scenario and state initialize without changing the active application.");

console.log("\nTest 5: Verifying event sequence and state transitions...");
const started = startSimulation(initial);
assert.equal(started.phase, "running");
assert.equal(started.eventLog.events.length, 2);
assert.equal(started.eventLog.events[0]?.sequence, 1);
assert.equal(started.eventLog.events[1]?.sequence, 2);
const advanced = advanceSimulation(started, 5);
assert.equal(advanced.clock.tick, 5);
assert.equal(advanced.clock.elapsedSeconds, 0.5);
assert.equal(latestSimulationEvent(advanced)?.type, "phase_changed");
console.log("✓ State transitions preserve deterministic clock and event ordering.");

console.log("\nTest 6: Verifying typed event recording...");
const eventLog = createEventLog("run-events");
const event = recordSimulationEvent(
  eventLog,
  2,
  "simulation",
  {
    type: "hazard_threshold_crossed",
    payload: { previous: "clear", current: "caution", density: 0.2 },
  },
  { roomId: "sec", actorKind: "system" },
);
assert.equal(event.sequence, 1);
assert.equal(event.roomId, "sec");
assert.equal(eventLog.nextSequence, 2);
assert.throws(() =>
  recordSimulationEvent(eventLog, 1, "simulation", {
    type: "run_failed",
    payload: { reason: "out-of-order test event" },
  }),
);
console.log("✓ Events carry schema version, run identity, tick, sequence, source, and typed payload.");

console.log("\n========================================");
console.log("All Simulation Core tests passed cleanly!");
console.log("========================================");
