import { deriveSimulationMetrics, type SimulationMetrics } from "./metrics";
import type { ScenarioDefinition, SimulationState } from "./types";

export const REPORT_SCHEMA_VERSION = 1 as const;

export type ReportSeverity = "info" | "warning";

export interface ReportFinding {
  id: string;
  severity: ReportSeverity;
  statement: string;
  eventSequences: number[];
}

export interface SimulationReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  runId: string;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  outcome: SimulationState["phase"];
  generatedAtTick: number;
  metrics: SimulationMetrics;
  findings: ReportFinding[];
  limitations: string[];
}

/** Network-safe live state; the full event log stays on the authority. */
export interface SimulationSnapshot {
  runId: string;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  phase: SimulationState["phase"];
  clock: SimulationState["clock"];
  incident: SimulationState["incident"];
  hazards: SimulationState["hazards"];
  connectors: SimulationState["connectors"];
  occupants: SimulationState["occupants"];
  assemblies: SimulationState["assemblies"];
  report: SimulationReport;
}

function uniqueSequences(sequences: number[]): number[] {
  return [...new Set(sequences)].sort((left, right) => left - right);
}

function finding(
  id: string,
  severity: ReportSeverity,
  statement: string,
  eventSequences: number[],
): ReportFinding {
  return { id, severity, statement, eventSequences: uniqueSequences(eventSequences) };
}

export function buildSimulationReport(
  state: SimulationState,
  scenario: ScenarioDefinition,
): SimulationReport {
  const metrics = deriveSimulationMetrics(state, scenario.world);
  const findings: ReportFinding[] = [];

  if (metrics.totalOccupants.value === 0) {
    findings.push(
      finding(
        "population-unavailable",
        "warning",
        "No occupant spawn events were recorded, so population outcome metrics are unavailable.",
        state.eventLog.events
          .filter((event) => event.type === "run_started")
          .map((event) => event.sequence),
      ),
    );
  } else if (metrics.accountability.assembled === metrics.accountability.total) {
    findings.push(
      finding(
        "accountability-complete",
        "info",
        `All ${metrics.accountability.total} recorded occupants reached an assembly zone.`,
        metrics.accountability.eventSequences,
      ),
    );
  } else {
    findings.push(
      finding(
        "accountability-incomplete",
        "warning",
        `${metrics.accountability.assembled} of ${metrics.accountability.total} recorded occupants reached an assembly zone; ${metrics.accountability.missing} were marked missing.`,
        metrics.accountability.eventSequences,
      ),
    );
  }

  for (const congestion of Object.values(metrics.congestion)) {
    findings.push(
      finding(
        `bottleneck-${congestion.connectorId}`,
        "warning",
        `Connector ${congestion.connectorId} recorded ${congestion.observations} capacity-wait observations, with up to ${congestion.maxWaitingOccupants} occupants waiting for capacity ${congestion.capacity ?? "unbounded"}.`,
        congestion.eventSequences,
      ),
    );
  }

  const exitCounts = Object.values(metrics.exitUtilization)
    .map((exit) => `${exit.exitId}: ${exit.assembledCount}`)
    .join(", ");
  if (exitCounts && metrics.totalOccupants.value > 0) {
    findings.push(
      finding(
        "exit-utilization",
        "info",
        `Observed assembly by exit: ${exitCounts}.`,
        Object.values(metrics.exitUtilization).flatMap((exit) => exit.eventSequences),
      ),
    );
  }

  if (metrics.routeChanges.value > 0) {
    findings.push(
      finding(
        "route-changes",
        "info",
        `${metrics.routeChanges.value} route-change events were recorded after initial assignment.`,
        metrics.routeChanges.eventSequences,
      ),
    );
  }

  for (const exposure of Object.values(metrics.exposure)) {
    if (exposure.peakDensity < 0.2 && exposure.minimumAir >= 100 && exposure.minimumHealth >= 100) continue;
    findings.push(
      finding(
        `exposure-${exposure.occupantId}`,
        "warning",
        `Occupant ${exposure.occupantId} recorded ${exposure.sampleCount} exposure samples, peak density ${exposure.peakDensity.toFixed(3)}, minimum air ${exposure.minimumAir.toFixed(1)}, and minimum health ${exposure.minimumHealth.toFixed(1)}.`,
        exposure.eventSequences,
      ),
    );
  }

  if (metrics.injuryTransitions.value > 0) {
    findings.push(
      finding(
        "injury-transitions",
        "warning",
        `${metrics.injuryTransitions.value} injury-state transitions were recorded.`,
        metrics.injuryTransitions.eventSequences,
      ),
    );
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    runId: state.runId,
    scenarioId: state.scenarioId,
    scenarioVersion: state.scenarioVersion,
    seed: state.seed,
    outcome: state.phase,
    generatedAtTick: state.clock.tick,
    metrics,
    findings,
    limitations: [
      "Hazard coefficients are authored prototype parameters, not physical measurements.",
      "Findings describe only events recorded in this simulation run.",
      "Accessibility conclusions require explicit accessible metadata in the scenario world.",
      "This report is for simulation analysis and does not establish regulatory or life-safety compliance.",
    ],
  };
}

export function buildSimulationSnapshot(
  state: SimulationState,
  scenario: ScenarioDefinition,
): SimulationSnapshot {
  return {
    runId: state.runId,
    scenarioId: state.scenarioId,
    scenarioVersion: state.scenarioVersion,
    seed: state.seed,
    phase: state.phase,
    clock: { ...state.clock },
    incident: { ...state.incident },
    hazards: { ...state.hazards },
    connectors: { ...state.connectors },
    occupants: { ...state.occupants },
    assemblies: { ...state.assemblies },
    report: buildSimulationReport(state, scenario),
  };
}
