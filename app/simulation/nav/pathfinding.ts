import type { Vec3 } from "../level";
import { NAV_EDGES } from "./edges";
import { NAV_NODES, nodeById } from "./nodes";
import type { NavigationEdge, NavigationNode, PathResult } from "./types";

/**
 * Calculates dynamic traversal cost of an edge based on metric distance,
 * quadratic smoke density, and physical blockage.
 */
export function calculateEdgeCost(edge: NavigationEdge): number {
  if (edge.status === "blocked") {
    return Infinity;
  }

  const smokeFactor = 1.0 + 8.0 * Math.pow(edge.smokeDensity, 2);
  const statusPenalty = edge.status === "compromised" ? 50.0 : 0.0;

  return edge.baseDistance * smokeFactor + statusPenalty;
}

/**
 * Finds the nearest navigation node in 2D (X/Z plane) to a given world position.
 */
export function findNearestNode(
  pos: Vec3,
  filter?: (node: NavigationNode) => boolean,
): NavigationNode {
  let closest = NAV_NODES[0];
  let minDistanceSq = Infinity;

  for (const node of NAV_NODES) {
    if (filter && !filter(node)) continue;
    const dx = node.position[0] - pos[0];
    const dz = node.position[2] - pos[2];
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = node;
    }
  }

  return closest;
}

/**
 * Euclidean distance heuristic in meters between two nodes.
 */
function heuristic(nodeA: NavigationNode, nodeB: NavigationNode): number {
  const dx = nodeA.position[0] - nodeB.position[0];
  const dz = nodeA.position[2] - nodeB.position[2];
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Computes the optimal path between two nodes using A* pathfinding.
 */
export function findPath(
  fromNodeId: string,
  toNodeId: string,
  edgeState?: Record<string, NavigationEdge>,
): PathResult {
  const startNode = nodeById(fromNodeId);
  const targetNode = nodeById(toNodeId);

  const failResult: PathResult = {
    found: false,
    nodes: [],
    edges: [],
    totalDistance: 0,
    totalCost: Infinity,
    targetExit: null,
    safetyRating: "critical",
  };

  if (!startNode || !targetNode) return failResult;
  if (fromNodeId === toNodeId) {
    return {
      found: true,
      nodes: [startNode],
      edges: [],
      totalDistance: 0,
      totalCost: 0,
      targetExit: toNodeId === "node-assembly-a" ? "assembly-a" : toNodeId === "node-assembly-b" ? "assembly-b" : null,
      safetyRating: "safe",
    };
  }

  // Build adjacency lookup
  const adj = new Map<string, { neighborId: string; edge: NavigationEdge }[]>();
  for (const defaultEdge of NAV_EDGES) {
    const edge = edgeState?.[defaultEdge.id] ?? defaultEdge;
    if (edge.status === "blocked") continue;

    // from -> to
    if (!adj.has(edge.fromNode)) adj.set(edge.fromNode, []);
    adj.get(edge.fromNode)!.push({ neighborId: edge.toNode, edge });

    // to -> from (if bidirectional)
    if (edge.bidirectional !== false) {
      if (!adj.has(edge.toNode)) adj.set(edge.toNode, []);
      adj.get(edge.toNode)!.push({ neighborId: edge.fromNode, edge });
    }
  }

  // Priority Queue / Open Set for A*
  const openSet = new Set<string>([fromNodeId]);
  const cameFromNode = new Map<string, string>();
  const cameFromEdge = new Map<string, NavigationEdge>();

  const gScore = new Map<string, number>();
  gScore.set(fromNodeId, 0);

  const fScore = new Map<string, number>();
  fScore.set(fromNodeId, heuristic(startNode, targetNode));

  while (openSet.size > 0) {
    // Node with lowest fScore
    let currentId = "";
    let lowestF = Infinity;
    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentId = nodeId;
      }
    }

    if (!currentId || lowestF === Infinity) break;

    if (currentId === toNodeId) {
      // Reconstruct path
      const pathNodes: NavigationNode[] = [];
      const pathEdges: NavigationEdge[] = [];
      let curr = currentId;

      while (curr) {
        const node = nodeById(curr);
        if (node) pathNodes.unshift(node);
        const edge = cameFromEdge.get(curr);
        if (edge) pathEdges.unshift(edge);
        curr = cameFromNode.get(curr) ?? "";
      }

      let totalDistance = 0;
      let totalCost = 0;
      let totalSmoke = 0;

      for (const e of pathEdges) {
        totalDistance += e.baseDistance;
        totalCost += calculateEdgeCost(e);
        totalSmoke += e.smokeDensity;
      }

      const avgSmoke = pathEdges.length > 0 ? totalSmoke / pathEdges.length : 0;
      const safetyRating: "safe" | "caution" | "critical" =
        avgSmoke < 0.15 ? "safe" : avgSmoke < 0.45 ? "caution" : "critical";

      const targetExit =
        toNodeId === "node-assembly-a"
          ? "assembly-a"
          : toNodeId === "node-assembly-b"
          ? "assembly-b"
          : null;

      return {
        found: true,
        nodes: pathNodes,
        edges: pathEdges,
        totalDistance,
        totalCost,
        targetExit,
        safetyRating,
      };
    }

    openSet.delete(currentId);
    const currentNode = nodeById(currentId);
    if (!currentNode) continue;

    const neighbors = adj.get(currentId) ?? [];
    for (const { neighborId, edge } of neighbors) {
      const neighborNode = nodeById(neighborId);
      if (!neighborNode) continue;

      const edgeCost = calculateEdgeCost(edge);
      if (edgeCost === Infinity) continue;

      const tentativeG = (gScore.get(currentId) ?? Infinity) + edgeCost;

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFromNode.set(neighborId, currentId);
        cameFromEdge.set(neighborId, edge);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighborNode, targetNode));
        openSet.add(neighborId);
      }
    }
  }

  return failResult;
}

/**
 * Finds the safest exterior exit route (Assembly A vs Assembly B) from any given position.
 */
export function findSafestExit(
  startPos: Vec3,
  edgeState?: Record<string, NavigationEdge>,
): { target: "assembly-a" | "assembly-b"; path: PathResult } {
  const startNode = findNearestNode(startPos);

  const pathA = findPath(startNode.id, "node-assembly-a", edgeState);
  const pathB = findPath(startNode.id, "node-assembly-b", edgeState);

  // If path A is found and path B is not
  if (pathA.found && !pathB.found) {
    return { target: "assembly-a", path: pathA };
  }
  // If path B is found and path A is not
  if (!pathA.found && pathB.found) {
    return { target: "assembly-b", path: pathB };
  }
  // If both found, choose the one with lower cost (safety + distance)
  if (pathA.found && pathB.found) {
    if (pathA.totalCost <= pathB.totalCost) {
      return { target: "assembly-a", path: pathA };
    } else {
      return { target: "assembly-b", path: pathB };
    }
  }

  // If neither found, return pathA fallback
  return { target: "assembly-a", path: pathA };
}
