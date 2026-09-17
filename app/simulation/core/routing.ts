import type {
  AccessibilityRequirement,
  ConnectorDefinition,
  ConnectorState,
  WorldDefinition,
} from "./types";
import type { RoomId } from "../level";

export interface RouteResult {
  found: boolean;
  targetExitId: string | null;
  connectorIds: string[];
  totalCost: number;
  safetyRating: "safe" | "caution" | "critical";
}

export interface RouteOptions {
  accessibility?: AccessibilityRequirement;
  smokeWeight?: number;
}

interface QueueEntry {
  roomId: RoomId;
  cost: number;
  connectorIds: string[];
  maxSmoke: number;
}

const failedRoute: RouteResult = {
  found: false,
  targetExitId: null,
  connectorIds: [],
  totalCost: Infinity,
  safetyRating: "critical",
};

function connectorCost(state: ConnectorState, smokeWeight: number): number {
  if (state.status === "blocked") return Infinity;
  return 1 + state.smokeDensity * smokeWeight + (state.status === "compromised" ? 3 : 0);
}

function nextRoom(
  connector: ConnectorDefinition,
  roomId: RoomId,
): RoomId | null {
  if (connector.from === roomId) return connector.to;
  if (connector.bidirectional && connector.to === roomId) return connector.from;
  return null;
}

function isAccessible(
  connector: ConnectorDefinition,
  accessibility: AccessibilityRequirement,
): boolean {
  return accessibility !== "accessible" || connector.accessible === true;
}

function exitIsAccessible(
  accessible: boolean | undefined,
  accessibility: AccessibilityRequirement,
): boolean {
  return accessibility !== "accessible" || accessible === true;
}

function resultFor(entry: QueueEntry, exitId: string): RouteResult {
  const safetyRating =
    entry.maxSmoke < 0.15 ? "safe" : entry.maxSmoke < 0.45 ? "caution" : "critical";
  return {
    found: true,
    targetExitId: exitId,
    connectorIds: entry.connectorIds,
    totalCost: entry.cost,
    safetyRating,
  };
}

export function findSafestExit(
  world: WorldDefinition,
  connectorStates: Record<string, ConnectorState>,
  startRoomId: RoomId,
  options: RouteOptions = {},
): RouteResult {
  const accessibility = options.accessibility ?? "standard";
  const smokeWeight = options.smokeWeight ?? 8;
  const exits = world.exits.filter((exit) => exitIsAccessible(exit.accessible, accessibility));
  if (exits.length === 0) return failedRoute;

  const queue: QueueEntry[] = [{ roomId: startRoomId, cost: 0, connectorIds: [], maxSmoke: 0 }];
  const bestCost = new Map<RoomId, number>([[startRoomId, 0]]);
  let best: RouteResult | null = null;

  while (queue.length > 0) {
    queue.sort((left, right) => left.cost - right.cost || left.connectorIds.length - right.connectorIds.length);
    const current = queue.shift()!;
    const exit = exits.find((candidate) => candidate.roomId === current.roomId);
    if (exit) {
      const result = resultFor(current, exit.id);
      if (!best || result.totalCost < best.totalCost) best = result;
      continue;
    }

    for (const connector of world.connectors) {
      if (!isAccessible(connector, accessibility)) continue;
      const neighbor = nextRoom(connector, current.roomId);
      if (!neighbor) continue;
      const connectorState = connectorStates[connector.id];
      if (!connectorState) continue;

      const cost = connectorCost(connectorState, smokeWeight);
      if (!Number.isFinite(cost)) continue;
      const nextCost = current.cost + cost;
      if (nextCost >= (bestCost.get(neighbor) ?? Infinity)) continue;

      bestCost.set(neighbor, nextCost);
      queue.push({
        roomId: neighbor,
        cost: nextCost,
        connectorIds: [...current.connectorIds, connector.id],
        maxSmoke: Math.max(current.maxSmoke, connectorState.smokeDensity),
      });
    }
  }

  return best ?? failedRoute;
}
