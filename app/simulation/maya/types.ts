import type { RoomId, Vec3 } from "../level";
import type { NavigationNode } from "../nav/types";

export type MayaStatus =
  | "CALM"
  | "ALARMED"
  | "WAITING_FOR_HELP"
  | "FOLLOWING"
  | "REASSESSING"
  | "LOST"
  | "DISTRESSED"
  | "SAFE"
  | "ABANDONED"
  | "INCAPACITATED";

export type MayaOutcome =
  | "saved"
  | "abandoned"
  | "incapacitated"
  | "unmet"
  | "in-transit";

export interface MayaConfig {
  walkSpeed: number;
  distressedSpeed: number;
  followDistance: number;
  lostDistanceThreshold: number;
  abandonDistanceThreshold: number;
  interactRadius: number;
  rescueRadius: number;
}

export const DEFAULT_MAYA_CONFIG: MayaConfig = {
  walkSpeed: 2.4,
  distressedSpeed: 1.3,
  followDistance: 2.0,
  lostDistanceThreshold: 12.0,
  abandonDistanceThreshold: 15.0,
  interactRadius: 3.5,
  rescueRadius: 3.5,
};

export type MayaEvent =
  | { type: "alarm" }
  | { type: "player_approached"; distance: number }
  | { type: "assisted" }
  | { type: "abandoned" }
  | { type: "hazard_detected"; dangerSector: RoomId; message?: string }
  | { type: "smoke_increased"; density: number }
  | { type: "reached_muster"; exit: "assembly-a" | "assembly-b" }
  | { type: "player_distanced"; distance: number }
  | { type: "player_rejoined" }
  | { type: "incapacitated" };

export interface MayaState {
  status: MayaStatus;
  position: Vec3;
  rotation: number;
  health: number;
  air: number;
  smokeExposure: number;
  sectorId: RoomId;
  currentWaypointIndex: number;
  assignedPath: NavigationNode[];
  targetExit: "assembly-a" | "assembly-b" | null;
  distanceToPlayer: number;
  assistedAt: number | null;
  abandonedAt: number | null;
  safeAt: number | null;
  dialogue: string | null;
  dialogueTimestamp: number;
}

export interface MayaContext {
  elapsedSeconds: number;
  playerPos: Vec3;
  localSmoke: number;
}
