export type Vec3 = [number, number, number];

/* Stable Room IDs for Level 2 Science & Engineering Building */
export type RoomId =
  | "classroom-204"    // Navigator spawn room
  | "classroom-205"    // Maya's room (Vulnerable Peer)
  | "workshop-203"    // Intermediate room
  | "lab-201"          // Nanotechnology research lab
  | "lab-202"          // Fire origin lab (Organic Chemistry)
  | "chem-store"       // Hazardous chemical storage
  | "prep-room"        // Research prep room
  | "corridor-west"    // West central spine
  | "junction-center"  // Central corridor junction
  | "corridor-east"    // East central spine
  | "stair-west"       // West stairwell leading to Fire Exit A
  | "stair-east"       // East stairwell leading to Fire Exit B
  | "assembly-a"       // West Courtyard muster point
  | "assembly-b"       // East Quad muster point
  | "outside";         // Exterior campus grounds

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
 * Level 2 Floorplan: Science & Engineering Building.
 * Features 2 distinct fire exit routes:
 *   - West: corridor-west -> stair-west -> Fire Exit A -> Assembly Area A
 *   - East: corridor-east -> stair-east -> Fire Exit B -> Assembly Area B
 */
export const ROOMS: RoomDef[] = [
  {
    id: "classroom-204",
    name: "Classroom 204",
    blurb: "Navigator start location. Emergency drills initiate here.",
    bounds: { minX: -22, maxX: -8, minZ: -10, maxZ: -2 },
    fog: false,
    floor: "#5c5e63",
    cam: { pos: [-15, 14, -6], target: [-15, 1.2, -4] },
  },
  {
    id: "classroom-205",
    name: "Classroom 205",
    blurb: "Student study room where peer Maya is located.",
    bounds: { minX: 8, maxX: 22, minZ: -10, maxZ: -2 },
    fog: false,
    floor: "#5c5e63",
    cam: { pos: [15, 14, -6], target: [15, 1.2, -4] },
  },
  {
    id: "workshop-203",
    name: "Workshop 203",
    blurb: "Shared engineering fabrication space.",
    bounds: { minX: -8, maxX: 8, minZ: -10, maxZ: -2 },
    fog: false,
    floor: "#54565b",
    cam: { pos: [0, 14, -6], target: [0, 1.2, -4] },
  },
  {
    id: "lab-201",
    name: "Lab 201 — Nanotech",
    blurb: "Advanced materials research laboratory.",
    bounds: { minX: -22, maxX: -8, minZ: 2, maxZ: 10 },
    fog: false,
    floor: "#47525d",
    cam: { pos: [-15, 14, 6], target: [-15, 1.2, 4] },
  },
  {
    id: "lab-202",
    name: "Lab 202 — Organic Chem",
    blurb: "Origin point of the chemical fire hazard.",
    bounds: { minX: -8, maxX: 6, minZ: 2, maxZ: 10 },
    fog: true,
    floor: "#634747",
    cam: { pos: [-1, 15, 6], target: [-1, 1.2, 4] },
  },
  {
    id: "chem-store",
    name: "Chemical Store",
    blurb: "Secure storage for combustible chemical reagents.",
    bounds: { minX: 6, maxX: 14, minZ: 2, maxZ: 10 },
    fog: true,
    floor: "#5c4d47",
    cam: { pos: [10, 13, 6], target: [10, 1.2, 4] },
  },
  {
    id: "prep-room",
    name: "Prep Room",
    blurb: "Laboratory glassware and reagent staging area.",
    bounds: { minX: 14, maxX: 22, minZ: 2, maxZ: 10 },
    fog: false,
    floor: "#4b5258",
    cam: { pos: [18, 13, 6], target: [18, 1.2, 4] },
  },
  {
    id: "corridor-west",
    name: "West Corridor",
    blurb: "Primary egress path connecting to West Stairwell and Exit A.",
    bounds: { minX: -22, maxX: -6, minZ: -2, maxZ: 2 },
    fog: false,
    floor: "#6a6e73",
    cam: { pos: [-14, 15, 0], target: [-14, 1.2, 0] },
  },
  {
    id: "junction-center",
    name: "Central Junction",
    blurb: "Key corridor intersection between East and West wings.",
    bounds: { minX: -6, maxX: 6, minZ: -2, maxZ: 2 },
    fog: true,
    floor: "#6e7278",
    cam: { pos: [0, 16, 0], target: [0, 1.2, 0] },
  },
  {
    id: "corridor-east",
    name: "East Corridor",
    blurb: "Corridor leading to East Stairwell (becomes compromised).",
    bounds: { minX: 6, maxX: 22, minZ: -2, maxZ: 2 },
    fog: true,
    floor: "#6a6e73",
    cam: { pos: [14, 15, 0], target: [14, 1.2, 0] },
  },
  {
    id: "stair-west",
    name: "West Stairwell & Exit A",
    blurb: "Verified safe emergency fire exit to West Courtyard.",
    bounds: { minX: -24, maxX: -16, minZ: 2, maxZ: 14 },
    fog: false,
    floor: "#3d4b44",
    cam: { pos: [-20, 15, 8], target: [-20, 1.2, 8] },
  },
  {
    id: "stair-east",
    name: "East Stairwell & Exit B",
    blurb: "Secondary fire exit (blocked by smoke accumulation).",
    bounds: { minX: 16, maxX: 24, minZ: 2, maxZ: 14 },
    fog: true,
    floor: "#4b3d3d",
    cam: { pos: [20, 15, 8], target: [20, 1.2, 8] },
  },
  {
    id: "assembly-a",
    name: "Assembly Area A (West)",
    blurb: "Designated outdoor safe muster point in West Courtyard.",
    bounds: { minX: -26, maxX: -14, minZ: 14, maxZ: 26 },
    fog: false,
    floor: "#252b27",
    cam: { pos: [-20, 18, 20], target: [-20, 1.2, 20] },
  },
  {
    id: "assembly-b",
    name: "Assembly Area B (East)",
    blurb: "Designated outdoor safe muster point in East Quad.",
    bounds: { minX: 14, maxX: 26, minZ: 14, maxZ: 26 },
    fog: false,
    floor: "#25282b",
    cam: { pos: [20, 18, 20], target: [20, 1.2, 20] },
  },
  {
    id: "outside",
    name: "Campus Grounds",
    blurb: "Open exterior perimeter surrounding the Science Building.",
    bounds: { minX: -45, maxX: 45, minZ: -30, maxZ: 35 },
    fog: false,
    floor: "#1e2226",
    cam: { pos: [0, 25, 0], target: [0, 1.2, 0] },
  },
];

export const roomById = (id: RoomId): RoomDef =>
  ROOMS.find((room) => room.id === id) ?? ROOMS[0];

export function roomAt(x: number, z: number): RoomId {
  for (const room of ROOMS) {
    if (room.id === "outside") continue;
    const b = room.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
      return room.id;
    }
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

const OUT = "#5a5e5c";
const IN = "#7a766e";

export const WALLS: WallDef[] = [
  // 1. South exterior wall (Classrooms & Workshop)
  { id: "w-south-ext", axis: "x", fixed: -10, from: -22.15, to: 22.15, color: OUT },

  // 2. West exterior wall (Classroom 204 & Corridor West)
  { id: "w-west-ext", axis: "z", fixed: -22, from: -10.15, to: 2.15, color: OUT },

  // 3. East exterior wall (Classroom 205 & Corridor East)
  { id: "w-east-ext", axis: "z", fixed: 22, from: -10.15, to: 2.15, color: OUT },

  // 4. North exterior wall (Labs & Chem Store)
  { id: "w-north-ext", axis: "x", fixed: 10, from: -22.15, to: 22.15, color: OUT },

  // 5. Corridor South Wall (Doors into Classrooms 204, Workshop 203, Classroom 205)
  {
    id: "w-corr-south",
    axis: "x",
    fixed: -2,
    from: -22.15,
    to: 22.15,
    color: IN,
    openings: [
      { at: -15, width: 1.8, height: 2.5 }, // Door into Classroom 204
      { at: 0, width: 1.8, height: 2.5 },   // Door into Workshop 203
      { at: 15, width: 1.8, height: 2.5 },  // Door into Classroom 205 (Maya)
    ],
  },

  // 6. Corridor North Wall (Doors into Labs & Stairwells)
  {
    id: "w-corr-north",
    axis: "x",
    fixed: 2,
    from: -22.15,
    to: 22.15,
    color: IN,
    openings: [
      { at: -20, width: 2.6, height: 2.8 }, // West Stairwell Entrance
      { at: -15, width: 1.8, height: 2.5 }, // Door into Lab 201
      { at: -1, width: 1.8, height: 2.5 },  // Door into Lab 202 (Fire origin)
      { at: 10, width: 1.8, height: 2.5 },  // Door into Chem Store
      { at: 18, width: 1.8, height: 2.5 },  // Door into Prep Room
      { at: 20, width: 2.6, height: 2.8 },  // East Stairwell Entrance
    ],
  },

  // 7. Interior Classroom Dividers
  { id: "w-div-c204-w203", axis: "z", fixed: -8, from: -10, to: -2, color: IN },
  { id: "w-div-w203-c205", axis: "z", fixed: 8, from: -10, to: -2, color: IN },

  // 8. Interior Lab Dividers
  { id: "w-div-l201-l202", axis: "z", fixed: -8, from: 2, to: 10, color: IN },
  { id: "w-div-l202-chem", axis: "z", fixed: 6, from: 2, to: 10, color: IN },
  { id: "w-div-chem-prep", axis: "z", fixed: 14, from: 2, to: 10, color: IN },

  // 9. West Stairwell Enclosure & Fire Exit A
  { id: "w-stair-w-outer", axis: "z", fixed: -24, from: 2, to: 14.15, color: OUT },
  { id: "w-stair-w-inner", axis: "z", fixed: -16, from: 2, to: 14.15, color: IN },
  {
    id: "w-stair-w-exit",
    axis: "x",
    fixed: 14,
    from: -24.15,
    to: -15.85,
    color: OUT,
    openings: [{ at: -20, width: 2.4, height: 2.7 }], // Fire Exit A to Assembly A
  },

  // 10. East Stairwell Enclosure & Fire Exit B
  { id: "w-stair-e-inner", axis: "z", fixed: 16, from: 2, to: 14.15, color: IN },
  { id: "w-stair-e-outer", axis: "z", fixed: 24, from: 2, to: 14.15, color: OUT },
  {
    id: "w-stair-e-exit",
    axis: "x",
    fixed: 14,
    from: 15.85,
    to: 24.15,
    color: OUT,
    openings: [{ at: 20, width: 2.4, height: 2.7 }],  // Fire Exit B to Assembly B
  },
];

export const MASSES: { x1: number; z1: number; x2: number; z2: number }[] = [];

export const SLABS: {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  ceiling?: boolean;
}[] = [
  // Main building interior slab
  { id: "slab-main", x1: -22.15, z1: -10.15, x2: 22.15, z2: 10.15, color: "#66635c", ceiling: true },
  // West stairwell slab
  { id: "slab-stair-w", x1: -24.15, z1: 1.85, x2: -15.85, z2: 14.15, color: "#4b544e", ceiling: true },
  // East stairwell slab
  { id: "slab-stair-e", x1: 15.85, z1: 1.85, x2: 24.15, z2: 14.15, color: "#544b4b", ceiling: true },
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
    id: "door-c204",
    label: "Classroom 204 Door",
    room: "classroom-204",
    at: [-15, 0, -2],
    axis: "x",
    width: 1.8,
    height: 2.5,
    color: "#38bdf8",
    swing: 1,
  },
  {
    id: "door-c205",
    label: "Classroom 205 Door",
    room: "classroom-205",
    at: [15, 0, -2],
    axis: "x",
    width: 1.8,
    height: 2.5,
    color: "#facc15",
    swing: -1,
  },
  {
    id: "door-l202",
    label: "Lab 202 Door",
    room: "lab-202",
    at: [-1, 0, 2],
    axis: "x",
    width: 1.8,
    height: 2.5,
    color: "#ef4444",
    swing: 1,
  },
];

/* --------------------------------------------------------------- markers & beacons */

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

export const MARKERS: MarkerDef[] = [
  {
    id: "east-route-evidence",
    kind: "evidence",
    label: "East route sensor",
    sub: "East stairwell heat & smoke",
    reveal: "evidence",
    room: "stair-east",
    color: C.red,
    position: [20, 1.8, 6],
    labelOffset: [0, 0.75, 0],
    source: "Stairwell B optical detector",
    nextAction: "Verify reading before sending route guidance.",
  },
  {
    id: "smoke-source-evidence",
    kind: "evidence",
    label: "Lab 202 smoke sensor",
    sub: "Chemical thermal runaway",
    reveal: "evidence",
    room: "lab-202",
    color: C.yellow,
    position: [-1, 1.8, 6],
    labelOffset: [0, 0.75, 0],
    source: "Organic Chemistry fume hood monitor",
    nextAction: "Confirm origin to evaluate ventilation capacity.",
  },
  {
    id: "ventilation-panel",
    kind: "intervention",
    label: "Emergency ventilation panel",
    sub: "HVAC smoke purge override",
    reveal: "warden",
    room: "junction-center",
    color: C.blue,
    position: [0, 1.8, -1.8],
    labelOffset: [0, 0.85, 0],
    source: "Building central control station",
    nextAction: "Engage purge once exit route is selected.",
  },
  {
    id: "west-route-sign",
    kind: "route",
    label: "West Exit A route sign",
    sub: "Verified primary egress route",
    reveal: "warden",
    room: "corridor-west",
    color: C.green,
    position: [-18, 2.4, 1.8],
    labelOffset: [0, 0.7, 0],
    source: "Tactical exit signage",
    nextAction: "Instruct Navigator to take West Stairwell.",
  },
];

/* Navigator starts deep inside Classroom 204 */
export const EVACUEE_SPAWN: Vec3 = [-15, 1.1, -6];

/* Twin Assembly Points */
export const ASSEMBLY_A_POS: Vec3 = [-20, 0, 20];
export const ASSEMBLY_B_POS: Vec3 = [20, 0, 20];

/* Maya (Vulnerable Peer) Spawn */
export const MAYA_SPAWN: Vec3 = [15, 1.0, -6];

export function isRevealed(
  reveal: Reveal,
  view: string,
  observed: boolean,
): boolean {
  if (view === "evacuee") return false;
  if (reveal === "warden") return true;
  return view === "evidence" || observed;
}
