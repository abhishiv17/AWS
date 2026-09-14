import type { NavigationNode } from "./types";

export const NAV_NODES: NavigationNode[] = [
  // Classrooms & South Wing
  {
    id: "node-c204",
    type: "room",
    label: "Classroom 204",
    position: [-15, 0, -6],
    roomId: "classroom-204",
  },
  {
    id: "node-d-c204",
    type: "door",
    label: "Door 204",
    position: [-15, 0, -2],
    roomId: "classroom-204",
  },
  {
    id: "node-w203",
    type: "room",
    label: "Workshop 203",
    position: [0, 0, -6],
    roomId: "workshop-203",
  },
  {
    id: "node-d-w203",
    type: "door",
    label: "Door 203",
    position: [0, 0, -2],
    roomId: "workshop-203",
  },
  {
    id: "node-c205",
    type: "room",
    label: "Classroom 205 (Maya)",
    position: [15, 0, -6],
    roomId: "classroom-205",
  },
  {
    id: "node-d-c205",
    type: "door",
    label: "Door 205",
    position: [15, 0, -2],
    roomId: "classroom-205",
  },

  // Labs & North Wing
  {
    id: "node-l201",
    type: "room",
    label: "Lab 201 (Nanotech)",
    position: [-15, 0, 6],
    roomId: "lab-201",
  },
  {
    id: "node-d-l201",
    type: "door",
    label: "Door Lab 201",
    position: [-15, 0, 2],
    roomId: "lab-201",
  },
  {
    id: "node-l202",
    type: "room",
    label: "Lab 202 (Fire Origin)",
    position: [-1, 0, 6],
    roomId: "lab-202",
  },
  {
    id: "node-d-l202",
    type: "door",
    label: "Door Lab 202",
    position: [-1, 0, 2],
    roomId: "lab-202",
  },
  {
    id: "node-chem",
    type: "room",
    label: "Chemical Store",
    position: [10, 0, 6],
    roomId: "chem-store",
  },
  {
    id: "node-d-chem",
    type: "door",
    label: "Door Chemical Store",
    position: [10, 0, 2],
    roomId: "chem-store",
  },
  {
    id: "node-prep",
    type: "room",
    label: "Prep Room",
    position: [18, 0, 6],
    roomId: "prep-room",
  },
  {
    id: "node-d-prep",
    type: "door",
    label: "Door Prep Room",
    position: [18, 0, 2],
    roomId: "prep-room",
  },

  // Central Spine & Junctions
  {
    id: "node-corr-w",
    type: "corridor",
    label: "West Corridor Spine",
    position: [-15, 0, 0],
    roomId: "corridor-west",
  },
  {
    id: "node-junction",
    type: "corridor",
    label: "Central Junction",
    position: [0, 0, 0],
    roomId: "junction-center",
  },
  {
    id: "node-corr-e",
    type: "corridor",
    label: "East Corridor Spine",
    position: [15, 0, 0],
    roomId: "corridor-east",
  },

  // West Egress Path (Exit A)
  {
    id: "node-stair-w-entry",
    type: "door",
    label: "West Stairwell Entry",
    position: [-20, 0, 2],
    roomId: "stair-west",
  },
  {
    id: "node-stair-w-landing",
    type: "stair",
    label: "West Stairwell Landing",
    position: [-20, 0, 8],
    roomId: "stair-west",
  },
  {
    id: "node-exit-a",
    type: "exit",
    label: "Fire Exit A",
    position: [-20, 0, 14],
    roomId: "stair-west",
  },
  {
    id: "node-assembly-a",
    type: "assembly",
    label: "Assembly Area A (West)",
    position: [-20, 0, 20],
    roomId: "assembly-a",
  },

  // East Egress Path (Exit B)
  {
    id: "node-stair-e-entry",
    type: "door",
    label: "East Stairwell Entry",
    position: [20, 0, 2],
    roomId: "stair-east",
  },
  {
    id: "node-stair-e-landing",
    type: "stair",
    label: "East Stairwell Landing",
    position: [20, 0, 8],
    roomId: "stair-east",
  },
  {
    id: "node-exit-b",
    type: "exit",
    label: "Fire Exit B",
    position: [20, 0, 14],
    roomId: "stair-east",
  },
  {
    id: "node-assembly-b",
    type: "assembly",
    label: "Assembly Area B (East)",
    position: [20, 0, 20],
    roomId: "assembly-b",
  },
];

export const nodeById = (id: string): NavigationNode | undefined =>
  NAV_NODES.find((node) => node.id === id);
