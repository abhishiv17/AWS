import { ASSEMBLY_Z, DOORS, ROOMS, type RoomId } from "../level";
import type { ConnectorDefinition, WorldDefinition } from "./types";

export const COMPACT_CONNECTORS: readonly ConnectorDefinition[] = [
  { id: "entry-outside", from: "entry", to: "outside", bidirectional: true },
  { id: "entry-lobby", from: "entry", to: "lobby", bidirectional: true },
  { id: "lobby-wcorr", from: "lobby", to: "wcorr", bidirectional: true },
  { id: "lobby-ecorr", from: "lobby", to: "ecorr", bidirectional: true },
  { id: "wcorr-sec", from: "wcorr", to: "sec", bidirectional: true, doorId: "door-utility" },
  { id: "ecorr-vault", from: "ecorr", to: "vault", bidirectional: true, doorId: "door-dorm" },
  { id: "vault-annex", from: "vault", to: "annex", bidirectional: true },
  { id: "wcorr-outside", from: "wcorr", to: "outside", bidirectional: true },
  { id: "ecorr-outside", from: "ecorr", to: "outside", bidirectional: true },
];

export function createCompactWorld(): WorldDefinition {
  const assemblyZoneId = "outdoor-assembly";
  return {
    id: "compact-campus-block",
    version: "level-v1",
    rooms: ROOMS.map(({ id, name, bounds }) => ({ id, name, bounds })),
    connectors: COMPACT_CONNECTORS,
    exits: [
      {
        id: "main-exit",
        roomId: "entry",
        assemblyZoneId,
      },
      {
        id: "west-exit",
        roomId: "wcorr",
        assemblyZoneId,
      },
      {
        id: "east-exit",
        roomId: "ecorr",
        assemblyZoneId,
      },
    ],
    assemblyZones: [
      {
        id: assemblyZoneId,
        roomId: "outside",
        position: [0, 0, ASSEMBLY_Z + 2],
      },
    ],
  };
}

export function validateWorld(world: WorldDefinition): string[] {
  const errors: string[] = [];
  const rooms = new Set<RoomId>();
  const connectors = new Set<string>();
  const exits = new Set<string>();
  const assemblyZones = new Set<string>();
  const knownRooms = new Set(world.rooms.map((room) => room.id));

  for (const room of world.rooms) {
    if (rooms.has(room.id)) errors.push(`Duplicate room: ${room.id}`);
    rooms.add(room.id);
  }

  for (const connector of world.connectors) {
    if (connectors.has(connector.id)) errors.push(`Duplicate connector: ${connector.id}`);
    if (!knownRooms.has(connector.from)) errors.push(`Unknown connector source room: ${connector.from}`);
    if (!knownRooms.has(connector.to)) errors.push(`Unknown connector target room: ${connector.to}`);
    if (connector.from === connector.to) errors.push(`Connector cannot link a room to itself: ${connector.id}`);
    connectors.add(connector.id);
  }

  for (const zone of world.assemblyZones) {
    if (assemblyZones.has(zone.id)) errors.push(`Duplicate assembly zone: ${zone.id}`);
    if (!knownRooms.has(zone.roomId)) errors.push(`Unknown assembly zone room: ${zone.roomId}`);
    assemblyZones.add(zone.id);
  }

  for (const exit of world.exits) {
    if (exits.has(exit.id)) errors.push(`Duplicate exit: ${exit.id}`);
    if (!knownRooms.has(exit.roomId)) errors.push(`Unknown exit room: ${exit.roomId}`);
    if (!assemblyZones.has(exit.assemblyZoneId)) {
      errors.push(`Unknown exit assembly zone: ${exit.assemblyZoneId}`);
    }
    exits.add(exit.id);
  }

  for (const door of DOORS) {
    if (door.room && !knownRooms.has(door.room)) errors.push(`Unknown door room: ${door.room}`);
  }

  return errors;
}
