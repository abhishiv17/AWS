import {
  ASSEMBLY_A_POS,
  ASSEMBLY_B_POS,
  roomAt,
  type Vec3,
} from "../level";
import {
  findSafestExit,
  type NavigationEdge,
} from "../nav";
import { getSectorSmoke, calculateAirDrainRate } from "../smoke";
import { transitionMaya } from "./stateMachine";
import {
  DEFAULT_MAYA_CONFIG,
  type MayaConfig,
  type MayaContext,
  type MayaState,
} from "./types";

function flatDist(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Autonomous tick loop for Maya's NPC behavior.
 * Maya strictly operates on the navigation graph, dynamic hazard state, and state machine.
 */
export function stepMayaAgent(
  current: MayaState,
  dt: number,
  playerPos: Vec3,
  navEdges: Record<string, NavigationEdge>,
  elapsedSeconds: number,
  ventilationActive: boolean = false,
  config: MayaConfig = DEFAULT_MAYA_CONFIG,
): {
  nextState: MayaState;
  logs: string[];
} {
  const safeDt = Math.max(0.001, Math.min(0.25, dt));
  const logs: string[] = [];

  // Update spatial tracking
  const currentSector = roomAt(current.position[0], current.position[2]);
  const distToPlayer = flatDist(current.position, playerPos);

  // Local smoke and air calculations
  const localSmoke = getSectorSmoke(currentSector, elapsedSeconds, ventilationActive);
  const airDrainRate = calculateAirDrainRate(localSmoke);
  const nextAir = Math.max(0, current.air - airDrainRate * safeDt);

  const context: MayaContext = {
    elapsedSeconds,
    playerPos,
    localSmoke,
  };

  let state: MayaState = {
    ...current,
    sectorId: currentSector,
    distanceToPlayer: distToPlayer,
    smokeExposure: localSmoke,
    air: nextAir,
  };

  // Check air exhaustion
  if (nextAir <= 0 && state.status !== "INCAPACITATED" && state.status !== "SAFE") {
    state = transitionMaya(state, { type: "incapacitated" }, context);
    logs.push("Maya collapsed due to smoke inhalation!");
    return { nextState: state, logs };
  }

  // Check muster arrival
  const distMusterA = flatDist(state.position, ASSEMBLY_A_POS);
  const distMusterB = flatDist(state.position, ASSEMBLY_B_POS);
  if (
    (distMusterA < config.rescueRadius || distMusterB < config.rescueRadius) &&
    state.status !== "SAFE"
  ) {
    const exit = distMusterA < distMusterB ? "assembly-a" : "assembly-b";
    state = transitionMaya(state, { type: "reached_muster", exit }, context);
    logs.push(
      `Maya reached ${exit === "assembly-a" ? "Assembly Area A (West)" : "Assembly Area B (East)"} safely!`,
    );
    return { nextState: state, logs };
  }

  // 1. Alarm reaction at t >= 15s
  if (elapsedSeconds >= 15.0 && state.status === "CALM") {
    state = transitionMaya(state, { type: "alarm" }, context);
    logs.push("Maya heard the fire alarm in Classroom 205.");
  }

  // 2. Player approach reaction
  if (
    (state.status === "ALARMED" || state.status === "CALM") &&
    distToPlayer <= config.interactRadius
  ) {
    state = transitionMaya(
      state,
      { type: "player_approached", distance: distToPlayer },
      context,
    );
  }

  // 3. Smoke distress reaction
  if (localSmoke >= 0.45 && state.status === "FOLLOWING") {
    state = transitionMaya(state, { type: "smoke_increased", density: localSmoke }, context);
  } else if (localSmoke < 0.30 && state.status === "DISTRESSED") {
    state = transitionMaya(state, { type: "smoke_increased", density: localSmoke }, context);
  }

  // 4. Lost / Rejoined tracking while following
  if (state.status === "FOLLOWING" && distToPlayer >= config.lostDistanceThreshold) {
    state = transitionMaya(
      state,
      { type: "player_distanced", distance: distToPlayer },
      context,
    );
    logs.push("Maya lost sight of you!");
  } else if (state.status === "LOST" && distToPlayer <= config.interactRadius) {
    state = transitionMaya(state, { type: "player_rejoined" }, context);
    logs.push("Maya rejoined your escort.");
  }

  // 5. Waypoint planning & Dynamic Hazard Rerouting
  const needsPathUpdate =
    (state.status === "FOLLOWING" || state.status === "REASSESSING") &&
    (state.assignedPath.length === 0 ||
      state.currentWaypointIndex >= state.assignedPath.length);

  // Check if any edge in remaining assigned path has become dangerous / blocked
  let routeAheadCompromised = false;
  if (state.status === "FOLLOWING" && state.assignedPath.length > 1) {
    for (
      let i = Math.max(0, state.currentWaypointIndex - 1);
      i < state.assignedPath.length - 1;
      i++
    ) {
      const u = state.assignedPath[i].id;
      const v = state.assignedPath[i + 1].id;
      for (const edge of Object.values(navEdges)) {
        if (
          ((edge.fromNode === u && edge.toNode === v) ||
            (edge.fromNode === v && edge.toNode === u)) &&
          (edge.status === "blocked" || edge.smokeDensity >= 0.5)
        ) {
          routeAheadCompromised = true;
          break;
        }
      }
      if (routeAheadCompromised) break;
    }
  }

  if (routeAheadCompromised && state.status === "FOLLOWING") {
    state = transitionMaya(
      state,
      {
        type: "hazard_detected",
        dangerSector: state.sectorId,
        message: "The path ahead is blocked by dense smoke! Recalculating route!",
      },
      context,
    );
    logs.push("Maya refuses to enter the compromised hallway. Recalculating safe path.");
  }

  // Compute / recompute safe path via Navigation Graph A*
  if (needsPathUpdate || state.status === "REASSESSING" || routeAheadCompromised) {
    const navResult = findSafestExit(state.position, navEdges);
    if (navResult.path.found && navResult.path.nodes.length > 0) {
      state.assignedPath = navResult.path.nodes;
      state.currentWaypointIndex = 0;
      state.targetExit = navResult.target;
      if (state.status === "REASSESSING") {
        state = transitionMaya(state, { type: "assisted" }, context);
      }
    }
  }

  // 6. Waypoint Steering & Movement
  if (
    (state.status === "FOLLOWING" || state.status === "DISTRESSED") &&
    state.assignedPath.length > 0 &&
    state.currentWaypointIndex < state.assignedPath.length
  ) {
    // Only move if we are farther than followDistance from the player (don't crowd)
    if (distToPlayer > config.followDistance || distToPlayer > 4.0) {
      const targetNode = state.assignedPath[state.currentWaypointIndex];
      const targetPos = targetNode.position;

      const dx = targetPos[0] - state.position[0];
      const dz = targetPos[2] - state.position[2];
      const distToWaypoint = Math.sqrt(dx * dx + dz * dz);

      if (distToWaypoint < 0.6) {
        // Advance to next waypoint
        state.currentWaypointIndex += 1;
      } else {
        // Move towards waypoint
        const speed =
          state.status === "DISTRESSED"
            ? config.distressedSpeed
            : config.walkSpeed;
        const step = Math.min(distToWaypoint, speed * safeDt);
        const dirX = dx / distToWaypoint;
        const dirZ = dz / distToWaypoint;

        const newX = state.position[0] + dirX * step;
        const newZ = state.position[2] + dirZ * step;
        const yaw = Math.atan2(dirX, dirZ);

        state.position = [newX, state.position[1], newZ];
        state.rotation = yaw;
      }
    }
  }

  return { nextState: state, logs };
}
