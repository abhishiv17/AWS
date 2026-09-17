import type { ScenarioProgress } from "./level";
import { CRITICAL_SCENARIO_OBJECTS } from "./level";

export interface DrillScore {
  /** Total score 0–100 */
  total: number;
  /** Letter grade */
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  /** Component scores for breakdown */
  breakdown: {
    survival: number;       // 0–25: completed + didn't fail
    time: number;           // 0–25: faster = better
    health: number;         // 0–20: remaining health
    air: number;            // 0–15: remaining air
    objectives: number;     // 0–15: objectives completed
  };
  /** Stars 1–5 for visual display */
  stars: number;
}

const OPTIMAL_TIME_S = 90;
const GENEROUS_TIME_S = 240;

/**
 * Calculate a drill score from the simulation end-state.
 *
 * Scoring philosophy: survival matters most, then speed, then remaining
 * resources. This mirrors real evacuation metrics — getting out alive and
 * fast is better than getting out slowly with every item.
 */
export function calculateDrillScore(opts: {
  completed: boolean;
  failed: boolean;
  elapsedSeconds: number;
  health: number;           // 0–100
  air: number;              // 0–100
  scenarioProgress: ScenarioProgress;
  interventionApplied: boolean;
  routeMessageReceived: boolean;
}): DrillScore {
  const {
    completed, failed, elapsedSeconds, health, air,
    scenarioProgress,
  } = opts;

  // --- Survival (0–25) ---
  const survival = completed ? 25 : failed ? 0 : 5;

  // --- Time (0–25) ---
  let time = 0;
  if (completed) {
    const clamped = Math.max(0, Math.min(GENEROUS_TIME_S, elapsedSeconds));
    const ratio = 1 - (clamped - OPTIMAL_TIME_S) / (GENEROUS_TIME_S - OPTIMAL_TIME_S);
    time = Math.round(Math.max(0, Math.min(25, ratio * 25)));
  }

  // --- Health (0–20) ---
  const healthScore = Math.round((Math.max(0, health) / 100) * 20);

  // --- Air (0–15) ---
  const airScore = Math.round((Math.max(0, air) / 100) * 15);

  // --- Objectives (0–15) ---
  const done = CRITICAL_SCENARIO_OBJECTS.filter((id) => scenarioProgress[id]).length;
  const objectivesScore = Math.round((done / CRITICAL_SCENARIO_OBJECTS.length) * 15);

  const total = Math.min(100, survival + time + healthScore + airScore + objectivesScore);

  // Bonus nudges (not added to score, but encourage good behaviour)
  // interventionApplied and routeMessageReceived are noted in debrief

  const grade = gradeFromScore(total);
  const stars = starsFromScore(total);

  return {
    total,
    grade,
    breakdown: {
      survival,
      time,
      health: healthScore,
      air: airScore,
      objectives: objectivesScore,
    },
    stars,
  };
}

function gradeFromScore(score: number): DrillScore["grade"] {
  if (score >= 95) return "S";
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function starsFromScore(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

export const GRADE_COLORS: Record<DrillScore["grade"], string> = {
  S: "#fbbf24",  // gold
  A: "#34d399",  // emerald
  B: "#38bdf8",  // sky
  C: "#a78bfa",  // violet
  D: "#fb923c",  // orange
  F: "#ef4444",  // red
};

export const GRADE_LABELS: Record<DrillScore["grade"], string> = {
  S: "Outstanding",
  A: "Great",
  B: "Good",
  C: "Acceptable",
  D: "Needs Work",
  F: "Failed",
};
