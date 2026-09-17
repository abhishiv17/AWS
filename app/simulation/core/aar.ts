import type { ReportFinding, SimulationReport } from "./report";

export interface AfterActionReview {
  outcome: SimulationReport["outcome"];
  elapsedSeconds: number;
  accountability: {
    assembled: number;
    total: number;
    missing: number;
    rate: number | null;
  };
  timing: {
    averageTimeToFirstMovementSeconds: number | null;
    averageEvacuationTimeSeconds: number | null;
  };
  coordination: {
    assistanceRequests: number;
    routeChanges: number;
    injuryTransitions: number;
    blockedConnectorChanges: number;
  };
  exposure: {
    peakDensity: number | null;
    minimumAir: number | null;
    minimumHealth: number | null;
  };
  findings: {
    warnings: number;
    info: number;
    priority: ReportFinding[];
  };
}

export function buildAfterActionReview(report: SimulationReport): AfterActionReview {
  const { metrics } = report;
  const exposure = Object.values(metrics.exposure);
  const findings = [...report.findings].sort((left, right) => {
    if (left.severity === right.severity) {
      return (left.eventSequences[0] ?? Number.MAX_SAFE_INTEGER) - (right.eventSequences[0] ?? Number.MAX_SAFE_INTEGER);
    }
    return left.severity === "warning" ? -1 : 1;
  });

  return {
    outcome: report.outcome,
    elapsedSeconds: metrics.elapsedSeconds,
    accountability: {
      assembled: metrics.accountability.assembled,
      total: metrics.accountability.total,
      missing: metrics.accountability.missing,
      rate: metrics.accountability.total > 0
        ? metrics.accountability.assembled / metrics.accountability.total
        : null,
    },
    timing: {
      averageTimeToFirstMovementSeconds: metrics.timing.averageTimeToFirstMovementSeconds?.value ?? null,
      averageEvacuationTimeSeconds: metrics.timing.averageEvacuationTimeSeconds?.value ?? null,
    },
    coordination: {
      assistanceRequests: metrics.assistanceRequests.value,
      routeChanges: metrics.routeChanges.value,
      injuryTransitions: metrics.injuryTransitions.value,
      blockedConnectorChanges: metrics.blockedConnectorChanges.value,
    },
    exposure: {
      peakDensity: exposure.length > 0 ? Math.max(...exposure.map((item) => item.peakDensity)) : null,
      minimumAir: exposure.length > 0 ? Math.min(...exposure.map((item) => item.minimumAir)) : null,
      minimumHealth: exposure.length > 0 ? Math.min(...exposure.map((item) => item.minimumHealth)) : null,
    },
    findings: {
      warnings: report.findings.filter((finding) => finding.severity === "warning").length,
      info: report.findings.filter((finding) => finding.severity === "info").length,
      priority: findings.slice(0, 3),
    },
  };
}
