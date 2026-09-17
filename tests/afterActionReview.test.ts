import assert from "node:assert/strict";
import {
  buildAfterActionReview,
  buildSimulationReport,
  createInitialSimulationState,
  createLiveScenario,
  startSimulation,
  stepSimulation,
} from "../app/simulation/core";

console.log("----------------------------------------");
console.log("Running After-Action Review Tests");
console.log("----------------------------------------\n");

const scenario = createLiveScenario(53);
let state = startSimulation(createInitialSimulationState(scenario, "run-aar"));
state = stepSimulation(state, scenario, 160);
const report = buildSimulationReport(state, scenario);
const review = buildAfterActionReview(report);
const exposures = Object.values(report.metrics.exposure);

assert.equal(review.outcome, report.outcome);
assert.equal(review.elapsedSeconds, report.metrics.elapsedSeconds);
assert.equal(review.accountability.assembled, report.metrics.accountability.assembled);
assert.equal(review.accountability.total, report.metrics.accountability.total);
assert.equal(
  review.accountability.rate,
  report.metrics.accountability.total > 0
    ? report.metrics.accountability.assembled / report.metrics.accountability.total
    : null,
);
assert.equal(review.coordination.routeChanges, report.metrics.routeChanges.value);
assert.equal(review.coordination.assistanceRequests, report.metrics.assistanceRequests.value);
assert.equal(
  review.exposure.peakDensity,
  exposures.length > 0 ? Math.max(...exposures.map((item) => item.peakDensity)) : null,
);
assert(review.findings.priority.every((finding) => report.findings.some((candidate) => candidate.id === finding.id)));
console.log("✓ AAR summaries preserve measured accountability, timing, coordination, exposure, and finding evidence.");

const emptyScenario = createLiveScenario(54);
const emptyReport = buildSimulationReport(createInitialSimulationState(emptyScenario, "run-empty-aar"), emptyScenario);
const emptyReview = buildAfterActionReview(emptyReport);
assert.equal(emptyReview.accountability.rate, null);
assert.equal(emptyReview.timing.averageEvacuationTimeSeconds, null);
assert.equal(emptyReview.exposure.peakDensity, null);
console.log("✓ Unavailable measurements remain explicitly unavailable instead of being fabricated.");

console.log("\n========================================");
console.log("All After-Action Review tests passed cleanly!");
console.log("========================================");
