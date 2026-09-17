import type { RoomId, Vec3 } from "../level";
import type { ConnectorStatus, HazardClassification } from "./events";
import type { SimulationSnapshot } from "./report";
import { findSafestExit, type RouteResult } from "./routing";
import type { WorldDefinition } from "./types";
import { createCompactWorld } from "./world";

export interface GuideNavigator {
  position: [number, number, number, number];
  sectorId: RoomId;
}

export interface GuideRoomReading {
  id: RoomId;
  name: string;
  density: number;
  classification: HazardClassification;
  updatedAtTick: number;
  occupantIds: string[];
}

export interface GuideConnectorReading {
  id: string;
  from: RoomId;
  to: RoomId;
  status: ConnectorStatus;
  smokeDensity: number;
  updatedAtTick: number;
  reason: string | null;
}

export interface GuideOccupantReading {
  id: string;
  profile: string;
  status: string;
  roomId: RoomId;
  position: Vec3;
  health: number;
  air: number;
  injury: string;
  targetExitId: string | null;
}

export interface GuideProjection {
  runId: string;
  phase: SimulationSnapshot["phase"];
  tick: number;
  elapsedSeconds: number;
  incidentOriginRoomId: RoomId;
  incidentIgnited: boolean;
  ventilationActive: boolean;
  rooms: GuideRoomReading[];
  connectors: GuideConnectorReading[];
  occupants: GuideOccupantReading[];
  navigator: GuideNavigator | null;
  recommendation: RouteResult | null;
}

export function buildGuideProjection(
  snapshot: SimulationSnapshot,
  navigator: GuideNavigator | null,
  world: WorldDefinition = createCompactWorld(),
): GuideProjection {
  const occupantIdsByRoom = new Map<RoomId, string[]>();
  for (const occupant of Object.values(snapshot.occupants)) {
    const occupants = occupantIdsByRoom.get(occupant.roomId) ?? [];
    occupants.push(occupant.id);
    occupantIdsByRoom.set(occupant.roomId, occupants);
  }

  return {
    runId: snapshot.runId,
    phase: snapshot.phase,
    tick: snapshot.clock.tick,
    elapsedSeconds: snapshot.clock.elapsedSeconds,
    incidentOriginRoomId: snapshot.incident.originRoomId,
    incidentIgnited: snapshot.incident.ignited,
    ventilationActive: snapshot.incident.ventilationActive,
    rooms: world.rooms.map((room) => {
      const hazard = snapshot.hazards[room.id];
      return {
        id: room.id,
        name: room.name,
        density: hazard?.density ?? 0,
        classification: hazard?.classification ?? "clear",
        updatedAtTick: hazard?.updatedAtTick ?? snapshot.clock.tick,
        occupantIds: [...(occupantIdsByRoom.get(room.id) ?? [])],
      };
    }),
    connectors: world.connectors.map((connector) => {
      const state = snapshot.connectors[connector.id];
      return {
        id: connector.id,
        from: connector.from,
        to: connector.to,
        status: state?.status ?? "open",
        smokeDensity: state?.smokeDensity ?? 0,
        updatedAtTick: state?.updatedAtTick ?? snapshot.clock.tick,
        reason: state?.reason ?? null,
      };
    }),
    occupants: Object.values(snapshot.occupants).map((occupant) => ({
      id: occupant.id,
      profile: occupant.profile,
      status: occupant.status,
      roomId: occupant.roomId,
      position: [...occupant.position] as Vec3,
      health: occupant.health,
      air: occupant.air,
      injury: occupant.injury,
      targetExitId: occupant.targetExitId,
    })),
    navigator,
    recommendation: navigator
      ? findSafestExit(world, snapshot.connectors, navigator.sectorId)
      : null,
  };
}
