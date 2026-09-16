import type { RoomId, Vec3 } from "../level";

export type NodeType =
  | "room"
  | "door"
  | "corridor"
  | "stair"
  | "exit"
  | "assembly";

export type EdgeStatus = "open" | "compromised" | "blocked";

export interface NavigationNode {
  id: string;
  type: NodeType;
  label: string;
  position: Vec3;
  roomId: RoomId;
}

export interface NavigationEdge {
  id: string;
  fromNode: string;
  toNode: string;
  /** Physical length in meters */
  baseDistance: number;
  /** Clear opening/corridor width in meters */
  clearWidth: number;
  status: EdgeStatus;
  /** Smoke density between 0.0 (clear) and 1.0 (impassable) */
  smokeDensity: number;
  isEmergencyExit: boolean;
  bidirectional?: boolean;
}

export interface PathResult {
  found: boolean;
  nodes: NavigationNode[];
  edges: NavigationEdge[];
  totalDistance: number;
  totalCost: number;
  targetExit: "assembly-a" | "assembly-b" | null;
  safetyRating: "safe" | "caution" | "critical";
}
