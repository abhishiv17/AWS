import type { RoomId } from "../level";
import type { EdgeStatus } from "../nav/types";

export type RouteClassification = "CLEAR" | "CAUTION" | "DANGEROUS" | "BLOCKED";
export type RouteCondition =
  | RouteClassification
  | "INTERVENED"
  | "clear"
  | "unsafe"
  | "intervened";

export interface HazardConfig {
  /** Room ID where the fire starts */
  originRoom: RoomId;
  /** Seconds from drill start until fire ignites */
  ignitionDelaySeconds: number;
  /** Smoke generation rate per second at the fire origin */
  generationRate: number;
  /** Natural smoke dissipation rate per second to exterior */
  dissipationRate: number;
  /** Ventilation intervention multiplier on generation */
  ventilationFactor: number;
}

export interface HazardState {
  elapsedSeconds: number;
  ignited: boolean;
  ventilationActive: boolean;
  /** Real-time smoke density per room [0.0 - 1.0] */
  sectorSmoke: Record<RoomId, number>;
  /** Real-time smoke density per navigation edge [0.0 - 1.0] */
  edgeSmoke: Record<string, number>;
  /** Classification per room */
  sectorClassification: Record<RoomId, RouteClassification>;
}

export interface HazardSnapshot {
  t: number;
  ignited: boolean;
  ventilationActive: boolean;
  originRoom: RoomId;
  sectorReadings: {
    roomId: RoomId;
    smokeDensity: number;
    classification: RouteClassification;
  }[];
  edgeHeatmap: {
    edgeId: string;
    smokeDensity: number;
    status: EdgeStatus;
  }[];
}
