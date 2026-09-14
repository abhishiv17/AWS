import type { RoomId } from "./level";
import {
  stepHazardSimulation,
  createInitialHazardState,
  classifyHazard,
  calculateAirDrainRate,
  createHazardSnapshot,
  type HazardState,
  type HazardSnapshot,
  type RouteCondition,
  type RouteClassification,
} from "./hazard";

export {
  classifyHazard,
  calculateAirDrainRate,
  createHazardSnapshot,
  type RouteCondition,
  type RouteClassification,
  type HazardSnapshot,
};

export const SMOKE_EXPOSURE_THRESHOLD = 0.15;
export const SMOKE_BLOCKED_THRESHOLD = 0.70;

/** Ventilation intervention reduces smoke generation by 80%. */
export const VENTILATION_SMOKE_FACTOR = 0.2;

export const AIR_DRAIN_PER_SECOND = 2.8;

/** The physical East route connects corridor-east to stair-east. */
export const BLOCKED_ROUTE = {
  from: "corridor-east" as const,
  to: "stair-east" as const,
  label: "East route (Exit B)",
};

let cachedState: HazardState = createInitialHazardState();
let cachedElapsed = 0;
let cachedVentilation = false;

/**
 * Return real-time physical smoke intensity for one sector at an elapsed run time,
 * computed via edge-based differential propagation originating in Lab 202.
 */
export function getSectorSmoke(
  roomId: RoomId,
  elapsedSeconds: number,
  ventilationActive: boolean = false,
): number {
  if (elapsedSeconds < cachedElapsed || ventilationActive !== cachedVentilation) {
    cachedState = createInitialHazardState();
    cachedElapsed = 0;
    cachedVentilation = ventilationActive;
  }

  const dt = elapsedSeconds - cachedElapsed;
  if (dt > 0.05) {
    const steps = Math.min(50, Math.ceil(dt / 0.1));
    const subDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      cachedState = stepHazardSimulation(cachedState, subDt, ventilationActive);
    }
    cachedElapsed = elapsedSeconds;
  }

  return cachedState.sectorSmoke[roomId] ?? 0;
}

/**
 * Route blockage is driven strictly by accumulated smoke density crossing the physical threshold
 * (S >= 0.70), rather than a hardcoded timer event.
 */
export function isRouteBlocked(
  fromRoom: RoomId,
  toRoom: RoomId,
  elapsedSeconds: number,
  ventilationActive: boolean = false,
): boolean {
  const isEastRoute =
    (fromRoom === BLOCKED_ROUTE.from && toRoom === BLOCKED_ROUTE.to) ||
    (fromRoom === BLOCKED_ROUTE.to && toRoom === BLOCKED_ROUTE.from);

  if (!isEastRoute) return false;

  const eastSmoke = Math.max(
    getSectorSmoke("corridor-east", elapsedSeconds, ventilationActive),
    getSectorSmoke("stair-east", elapsedSeconds, ventilationActive),
  );

  return eastSmoke >= SMOKE_BLOCKED_THRESHOLD;
}

/**
 * Returns a complete telemetry snapshot of the physical hazard simulation state
 * for telemetry and Guide role awareness.
 */
export function getHazardSnapshot(
  elapsedSeconds: number,
  ventilationActive: boolean = false,
): HazardSnapshot {
  getSectorSmoke("lab-202", elapsedSeconds, ventilationActive);
  return createHazardSnapshot(cachedState);
}

