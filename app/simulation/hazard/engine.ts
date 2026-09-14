import type { RoomId } from "../level";
import { ROOMS } from "../level";
import type { EdgeStatus } from "../nav/types";
import { NAV_EDGES } from "../nav/edges";
import type {
  HazardConfig,
  HazardSnapshot,
  HazardState,
  RouteClassification,
} from "./types";

export const DEFAULT_HAZARD_CONFIG: HazardConfig = {
  originRoom: "lab-202",
  ignitionDelaySeconds: 15,
  generationRate: 0.08, // Matches spec Section 6.1 (0.08/sec after ignition)
  dissipationRate: 0.005,
  ventilationFactor: 0.2, // 80% reduction when ventilation override applied
};

/**
 * Spatial adjacency & flow conductance between rooms in Level 2 building.
 * Conductance represents flow rate coefficient C_{j -> i} (1/sec).
 */
export const ROOM_ADJACENCY: { from: RoomId; to: RoomId; conductance: number }[] = [
  // Fire origin Lab 202 connects to Central Junction and adjacent spaces
  { from: "lab-202", to: "junction-center", conductance: 0.15 },
  { from: "lab-202", to: "chem-store", conductance: 0.10 },
  { from: "lab-202", to: "lab-201", conductance: 0.02 },

  // Chemical Store & Prep Room connections
  { from: "chem-store", to: "prep-room", conductance: 0.08 },
  { from: "chem-store", to: "corridor-east", conductance: 0.12 },
  { from: "prep-room", to: "corridor-east", conductance: 0.08 },

  // Central Junction to corridor spines
  { from: "junction-center", to: "corridor-east", conductance: 0.16 }, // stack effect pulls smoke east
  { from: "junction-center", to: "corridor-west", conductance: 0.07 },
  { from: "junction-center", to: "workshop-203", conductance: 0.04 },

  // East Corridor to East Stairwell (thermal buoyancy stack effect)
  { from: "corridor-east", to: "stair-east", conductance: 0.16 },
  { from: "corridor-east", to: "classroom-205", conductance: 0.035 },

  // West Corridor to West Stairwell & Classroom 204
  { from: "corridor-west", to: "stair-west", conductance: 0.015 }, // positive pressure stairwell keeps West clear
  { from: "corridor-west", to: "classroom-204", conductance: 0.02 },
  { from: "corridor-west", to: "lab-201", conductance: 0.03 },

  // Stairwells to Exterior Exits
  { from: "stair-east", to: "assembly-b", conductance: 0.03 },
  { from: "stair-west", to: "assembly-a", conductance: 0.06 }, // fresh exterior air draw
];

/**
 * Classifies smoke density into discrete 4-stage route conditions.
 */
export function classifyHazard(density: number): RouteClassification {
  if (density < 0.15) return "CLEAR";
  if (density < 0.45) return "CAUTION";
  if (density < 0.70) return "DANGEROUS";
  return "BLOCKED";
}

/**
 * Maps classification to navigation edge status.
 * Emergency exits and fire stairwells physically block at S >= 0.70,
 * while corridors become heavily compromised with toxic air.
 */
export function classificationToEdgeStatus(
  cls: RouteClassification,
  edge?: { isEmergencyExit?: boolean; id?: string },
): EdgeStatus {
  switch (cls) {
    case "CLEAR":
    case "CAUTION":
      return "open";
    case "DANGEROUS":
      return "compromised";
    case "BLOCKED":
      if (edge && !edge.isEmergencyExit && !edge.id?.includes("stair") && !edge.id?.includes("l202")) {
        return "compromised";
      }
      return "blocked";
  }
}

/**
 * Calculates air quality depletion rate (% air / second) based on local smoke exposure.
 */
export function calculateAirDrainRate(localDensity: number): number {
  if (localDensity < 0.15) return 0.0;
  if (localDensity < 0.45) {
    // Light smoke / irritation: gentle drain scaling from 0 to 1.2%/sec
    return ((localDensity - 0.15) / 0.30) * 1.2;
  }
  if (localDensity < 0.70) {
    // Dense smoke / coughing: 2.8% per second
    return 2.8;
  }
  // Toxic / thermal threshold: 6.5% per second
  return 6.5;
}

/**
 * Creates initial hazard state at drill start (all rooms clear).
 */
export function createInitialHazardState(): HazardState {
  const sectorSmoke = {} as Record<RoomId, number>;
  const sectorClassification = {} as Record<RoomId, RouteClassification>;
  for (const r of ROOMS) {
    sectorSmoke[r.id] = 0.0;
    sectorClassification[r.id] = "CLEAR";
  }

  const edgeSmoke = {} as Record<string, number>;
  for (const e of NAV_EDGES) {
    edgeSmoke[e.id] = 0.0;
  }

  return {
    elapsedSeconds: 0,
    ignited: false,
    ventilationActive: false,
    sectorSmoke,
    edgeSmoke,
    sectorClassification,
  };
}

/**
 * Advances the dynamic physical smoke simulation by delta time (dt seconds)
 * using edge-based differential adjacency transfer.
 */
export function stepHazardSimulation(
  current: HazardState,
  dt: number,
  ventilationActive: boolean = false,
  config: HazardConfig = DEFAULT_HAZARD_CONFIG,
): HazardState {
  const safeDt = Math.max(0.001, Math.min(0.2, dt));
  const nextElapsed = current.elapsedSeconds + safeDt;
  const isIgnited = nextElapsed >= config.ignitionDelaySeconds;

  const nextSectorSmoke = { ...current.sectorSmoke };
  const dSmoke = {} as Record<RoomId, number>;
  for (const r of ROOMS) dSmoke[r.id] = 0;

  // 1. Generation at fire origin
  if (isIgnited) {
    const genMultiplier = ventilationActive ? config.ventilationFactor : 1.0;
    dSmoke[config.originRoom] += config.generationRate * genMultiplier * safeDt;
  }

  // 2. Differential adjacency flow transfer
  for (const flow of ROOM_ADJACENCY) {
    const sFrom = current.sectorSmoke[flow.from] ?? 0;
    const sTo = current.sectorSmoke[flow.to] ?? 0;

    if (sFrom > sTo) {
      const transfer = (sFrom - sTo) * flow.conductance * safeDt;
      dSmoke[flow.to] += transfer;
      // When flowing to outdoor exits, smoke leaves the building completely
      const lossMultiplier = flow.to === "assembly-a" || flow.to === "assembly-b" ? 1.0 : 0.85;
      dSmoke[flow.from] -= transfer * lossMultiplier;
    } else if (sTo > sFrom) {
      // Flow can also occur in reverse if concentration reverses
      const transfer = (sTo - sFrom) * flow.conductance * 0.6 * safeDt;
      dSmoke[flow.from] += transfer;
      const lossMultiplier = flow.from === "assembly-a" || flow.from === "assembly-b" ? 1.0 : 0.85;
      dSmoke[flow.to] -= transfer * lossMultiplier;
    }
  }

  // 3. Dissipation & Ventilation
  const dissipationMultiplier = ventilationActive ? 3.0 : 1.0;
  for (const r of ROOMS) {
    // Exterior and stairwell exits dissipate naturally
    if (r.id === "outside" || r.id === "assembly-a" || r.id === "assembly-b") {
      nextSectorSmoke[r.id] = 0.0;
      continue;
    }

    const currentS = current.sectorSmoke[r.id] ?? 0;
    const loss = currentS * config.dissipationRate * dissipationMultiplier * safeDt;
    const updated = Math.max(0, Math.min(1.0, currentS + dSmoke[r.id] - loss));
    nextSectorSmoke[r.id] = updated;
  }

  // Exterior areas always remain fresh
  nextSectorSmoke["outside"] = 0.0;
  nextSectorSmoke["assembly-a"] = 0.0;
  nextSectorSmoke["assembly-b"] = 0.0;

  // 4. Update sector classifications
  const nextClassification = {} as Record<RoomId, RouteClassification>;
  for (const r of ROOMS) {
    nextClassification[r.id] = classifyHazard(nextSectorSmoke[r.id]);
  }

  // 5. Update Navigation Edge smoke densities based on connected node rooms
  const nextEdgeSmoke = { ...current.edgeSmoke };
  for (const edge of NAV_EDGES) {
    // An edge's smoke is primarily governed by the rooms it spans
    const sRoom = edgeToRoom(edge.id, nextSectorSmoke);
    nextEdgeSmoke[edge.id] = sRoom;
  }

  return {
    elapsedSeconds: nextElapsed,
    ignited: isIgnited,
    ventilationActive,
    sectorSmoke: nextSectorSmoke,
    edgeSmoke: nextEdgeSmoke,
    sectorClassification: nextClassification,
  };
}

/**
 * Maps a Navigation Edge ID to its corresponding room smoke level.
 */
function edgeToRoom(edgeId: string, sectorSmoke: Record<RoomId, number>): number {
  if (edgeId.includes("c204")) return sectorSmoke["classroom-204"] ?? 0;
  if (edgeId.includes("c205")) return sectorSmoke["classroom-205"] ?? 0;
  if (edgeId.includes("w203")) return sectorSmoke["workshop-203"] ?? 0;
  if (edgeId.includes("l201")) return sectorSmoke["lab-201"] ?? 0;
  if (edgeId.includes("l202")) return sectorSmoke["lab-202"] ?? 0;
  if (edgeId.includes("chem")) return sectorSmoke["chem-store"] ?? 0;
  if (edgeId.includes("prep")) return sectorSmoke["prep-room"] ?? 0;
  if (edgeId.includes("corrw") && !edgeId.includes("junct")) return sectorSmoke["corridor-west"] ?? 0;
  if (edgeId.includes("junct")) {
    if (edgeId.includes("corre")) {
      return ((sectorSmoke["junction-center"] ?? 0) + (sectorSmoke["corridor-east"] ?? 0)) / 2;
    }
    return sectorSmoke["junction-center"] ?? 0;
  }
  if (edgeId.includes("corre") && !edgeId.includes("stair")) return sectorSmoke["corridor-east"] ?? 0;
  if (edgeId.includes("stairw")) return sectorSmoke["stair-west"] ?? 0;
  if (edgeId.includes("staire")) {
    // The entry from east corridor into east stairwell reflects the accumulating threshold
    return Math.max(sectorSmoke["corridor-east"] ?? 0, sectorSmoke["stair-east"] ?? 0);
  }
  return 0;
}

/**
 * Generates an authoritative telemetry snapshot for Guide synchronization.
 */
export function createHazardSnapshot(state: HazardState): HazardSnapshot {
  return {
    t: state.elapsedSeconds,
    ignited: state.ignited,
    ventilationActive: state.ventilationActive,
    originRoom: DEFAULT_HAZARD_CONFIG.originRoom,
    sectorReadings: (Object.keys(state.sectorSmoke) as RoomId[]).map((roomId) => ({
      roomId,
      smokeDensity: state.sectorSmoke[roomId],
      classification: state.sectorClassification[roomId],
    })),
    edgeHeatmap: NAV_EDGES.map((edge) => {
      const smokeDensity = state.edgeSmoke[edge.id] ?? 0;
      const cls = classifyHazard(smokeDensity);
      return {
        edgeId: edge.id,
        smokeDensity,
        status: classificationToEdgeStatus(cls, edge),
      };
    }),
  };
}
