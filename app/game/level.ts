export type Vec3 = [number, number, number];

/* The compact authored block. IDs are stable across render, collision, and events. */
export type RoomId =
  | "outside"
  | "entry"
  | "lobby"
  | "wcorr"
  | "ecorr"
  | "sec"
  | "vault"
  | "annex";

export const WALL_T = 0.3;
export const ROOM_H = 3.8;

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomDef {
  id: RoomId;
  name: string;
  blurb: string;
  bounds: Bounds;
  fog: boolean;
  floor: string;
  cam: { pos: Vec3; target: Vec3 };
}

/**
 * The renderer retains the compact block foundation while the labels and
 * interaction catalog describe the CampusEvac topology.
 */
export const ROOMS: RoomDef[] = [
  {
    id: "outside",
    name: "Outdoor Assembly",
    blurb: "Safe staging area with the assembly beacon ahead.",
    bounds: { minX: -14, maxX: 14, minZ: 10.5, maxZ: 26 },
    fog: false,
    floor: "#2c2f33",
    cam: { pos: [0, 15, 33], target: [0, 2, 3] },
  },
  {
    id: "entry",
    name: "Main Foyer",
    blurb: "Notice wall and orientation point for the drill.",
    bounds: { minX: -3, maxX: 3, minZ: 7, maxZ: 10.5 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [0, 11, 26], target: [0, 1.6, 6] },
  },
  {
    id: "lobby",
    name: "Corridor Junction",
    blurb: "Primary route decision between the west and east stairs.",
    bounds: { minX: -5.5, maxX: 5.5, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#7b7770",
    cam: { pos: [0, 19.9, 14], target: [0, 0.6, 0] },
  },
  {
    id: "wcorr",
    name: "West Stair",
    blurb: "Candidate route to the outdoor assembly point.",
    bounds: { minX: -8, maxX: -5.5, minZ: 1, maxZ: 4 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [-7, 9, 18], target: [-7, 1.4, 2] },
  },
  {
    id: "ecorr",
    name: "East Stair",
    blurb: "Route edge that becomes unsafe during the scenario.",
    bounds: { minX: 5.5, maxX: 8, minZ: 1, maxZ: 4 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [7, 9, 18], target: [7, 1.4, 2] },
  },
  {
    id: "sec",
    name: "Lab and Utility",
    blurb: "Smoke source evidence and the ventilation panel.",
    bounds: { minX: -22, maxX: -8, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#78746d",
    cam: { pos: [-1, 19.9, 0], target: [-15, 0.6, 0] },
  },
  {
    id: "vault",
    name: "Dorm Wing",
    blurb: "A secondary campus sector beyond the east passage.",
    bounds: { minX: 8, maxX: 22, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#78746d",
    cam: { pos: [1, 19.9, 0], target: [15, 0.6, 0] },
  },
  {
    id: "annex",
    name: "Electrical Service",
    blurb: "Authored smoke origin and recovery route.",
    bounds: { minX: 13, maxX: 17, minZ: -10, maxZ: -7 },
    fog: false,
    floor: "#5d5a55",
    cam: { pos: [15, 9, 14], target: [15, 1.4, -7] },
  },
];

export const roomById = (id: RoomId) => ROOMS.find((room) => room.id === id)!;

export function roomAt(x: number, z: number): RoomId {
  for (const room of ROOMS) {
    if (room.id === "outside") continue;
    const bounds = room.bounds;
    if (
      x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ
    )
      return room.id;
  }
  return "outside";
}

/* ------------------------------------------------------------------- walls */

export interface Opening {
  at: number;
  width: number;
  height?: number;
}

export interface WallDef {
  id: string;
  axis: "x" | "z";
  fixed: number;
  from: number;
  to: number;
  openings?: Opening[];
  height?: number;
  cutaway?: boolean;
  color?: string;
}

const OUT = "#6c706d";
const IN = "#8f8b83";

export const WALLS: WallDef[] = [
  {
    id: "w-north",
    axis: "x",
    fixed: -7,
    from: -22.15,
    to: 22.15,
    color: OUT,
    openings: [{ at: 15, width: 3.6, height: 2.9 }],
  },
  { id: "w-west", axis: "z", fixed: -22, from: -7.15, to: 7.15, color: OUT },
  { id: "w-east", axis: "z", fixed: 22, from: -7.15, to: 7.15, color: OUT },
  {
    id: "w-south-w",
    axis: "x",
    fixed: 7,
    from: -22.15,
    to: -3,
    color: OUT,
    cutaway: true,
  },
  {
    id: "w-south-e",
    axis: "x",
    fixed: 7,
    from: 3,
    to: 22.15,
    color: OUT,
    cutaway: true,
  },
  { id: "w-entry-w", axis: "z", fixed: -3, from: 7, to: 10.65, color: OUT },
  { id: "w-entry-e", axis: "z", fixed: 3, from: 7, to: 10.65, color: OUT },
  {
    id: "w-entry-s",
    axis: "x",
    fixed: 10.5,
    from: -3.15,
    to: 3.15,
    height: 3.2,
    color: OUT,
    openings: [{ at: 0, width: 3, height: 2.6 }],
  },
  { id: "w-annex-w", axis: "z", fixed: 13, from: -10.15, to: -7, color: OUT },
  { id: "w-annex-e", axis: "z", fixed: 17, from: -10.15, to: -7, color: OUT },
  { id: "w-annex-n", axis: "x", fixed: -10, from: 12.85, to: 17.15, color: OUT },
  {
    id: "w-sec-e",
    axis: "z",
    fixed: -8,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-lobby-w",
    axis: "z",
    fixed: -5.5,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-lobby-e",
    axis: "z",
    fixed: 5.5,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-vault-w",
    axis: "z",
    fixed: 8,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
];

export const MASSES: { x1: number; z1: number; x2: number; z2: number }[] = [
  { x1: -8, z1: -7.15, x2: -5.5, z2: 1 },
  { x1: -8, z1: 4, x2: -5.5, z2: 7.15 },
  { x1: 5.5, z1: -7.15, x2: 8, z2: 1 },
  { x1: 5.5, z1: 4, x2: 8, z2: 7.15 },
];

export const SLABS: {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  ceiling?: boolean;
}[] = [
  { id: "main", x1: -22.15, z1: -7.15, x2: 22.15, z2: 7.15, color: "#7d7a73", ceiling: true },
  { id: "entry", x1: -3.15, z1: 7.15, x2: 3.15, z2: 10.65, color: "#6e6a63", ceiling: true },
  { id: "annex", x1: 12.85, z1: -10.15, x2: 17.15, z2: -7, color: "#5d5a55", ceiling: true },
];

/* ------------------------------------------------------------------- doors */

export interface DoorDef {
  id: string;
  label: string;
  room: RoomId;
  at: Vec3;
  axis: "x" | "z";
  width: number;
  height: number;
  color: string;
  swing: 1 | -1;
}

export const DOORS: DoorDef[] = [
  {
    id: "door-utility",
    label: "Utility access door",
    room: "wcorr",
    at: [-8, 0, 2.5],
    axis: "z",
    width: 1.6,
    height: 2.4,
    color: "#38bdf8",
    swing: 1,
  },
  {
    id: "door-dorm",
    label: "Dorm wing access door",
    room: "ecorr",
    at: [5.5, 0, 2.5],
    axis: "z",
    width: 1.6,
    height: 2.4,
    color: "#facc15",
    swing: -1,
  },
];

/* --------------------------------------------------------------- evidence */

export type Reveal = "warden" | "evidence";
export type MarkerKind = "evidence" | "intervention" | "route";

export interface MarkerDef {
  id: string;
  kind: MarkerKind;
  label: string;
  sub?: string;
  reveal: Reveal;
  room: RoomId;
  color: string;
  position: Vec3;
  labelOffset?: Vec3;
  rotationY?: number;
  source?: string;
  nextAction?: string;
}

export const C = {
  red: "#ef4444",
  yellow: "#facc15",
  blue: "#38bdf8",
  green: "#10b981",
  slate: "#334155",
};

/** Stable IDs are shared by the local fixtures, AppSync payloads, and renderer. */
export const MARKERS: MarkerDef[] = [
  {
    id: "east-route-evidence",
    kind: "evidence",
    label: "East route sensor",
    sub: "observed route block",
    reveal: "evidence",
    room: "sec",
    color: C.red,
    position: [-11.2, 1.3, 0.2],
    labelOffset: [0, 0.75, 0],
    source: "Utility sector sensor feed",
    nextAction: "Verify before sending route guidance.",
  },
  {
    id: "smoke-source-evidence",
    kind: "evidence",
    label: "Smoke source reading",
    sub: "observed 8 seconds ago",
    reveal: "evidence",
    room: "sec",
    color: C.yellow,
    position: [-19, 1.1, -4],
    labelOffset: [0, 0.75, 0],
    source: "Electrical service monitor",
    nextAction: "Compare the source with the route status.",
  },
  {
    id: "ventilation-panel",
    kind: "intervention",
    label: "Ventilation panel",
    sub: "one authorized intervention",
    reveal: "warden",
    room: "sec",
    color: C.blue,
    position: [-12.2, 2, -6.8],
    labelOffset: [0, 0.85, 0],
    source: "Utility control panel",
    nextAction: "Apply only after the route evidence is verified.",
  },
  {
    id: "west-route-sign",
    kind: "route",
    label: "West route sign",
    sub: "alternate route to assembly",
    reveal: "warden",
    room: "lobby",
    color: C.green,
    position: [-2.8, 2.5, -6.8],
    labelOffset: [0, 0.7, 0],
    source: "Physical route signage",
    nextAction: "Send the west route when the block is verified.",
  },
];

export const EVACUEE_SPAWN: Vec3 = [0, 1.1, 9];
export const ASSEMBLY_Z = 13.5;

export function isRevealed(
  reveal: Reveal,
  view: string,
  observed: boolean,
): boolean {
  if (view === "evacuee") return false;
  if (reveal === "warden") return true;
  return view === "evidence" || observed;
}
