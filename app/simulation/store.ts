"use client";

import { create } from "zustand";
import { EVACUEE_SPAWN, type RoomId, type Vec3 } from "./level";
import {
  NAV_EDGES,
  findSafestExit,
  type NavigationEdge,
  type NavigationNode,
} from "./nav";
import {
  SMOKE_EXPOSURE_THRESHOLD,
  classifyHazard,
  calculateAirDrainRate,
  getSectorSmoke,
  type RouteCondition,
} from "./smoke";
import {
  createInitialMayaState,
  transitionMaya,
  type MayaState,
  type MayaOutcome,
} from "./maya";
import type {
  CommandAcknowledgement,
  EvidenceRecord,
  LogEntry,
  RouteMessage,
  WardenState,
} from "./net/types";

export type ViewMode = "evacuee" | "warden" | "evidence";

/** How the evacuee sees the world: over the shoulder (default) or through their own eyes. */
export type CameraMode = "third" | "first";

export type SimulationMode =
  | { kind: "solo" }
  | { kind: "evacuee" }
  | { kind: "warden"; sectorId: RoomId };

export const VIEWS: {
  id: ViewMode;
  n: string;
  title: string;
  blurb: string;
  color: string;
}[] = [
  {
    id: "evacuee",
    n: "1",
    title: "Evacuee View",
    blurb: "Immediate conditions, physical cues, and route messages only.",
    color: "#38bdf8",
  },
  {
    id: "warden",
    n: "2",
    title: "Warden Station",
    blurb: "One sector of evidence, verification, and bounded intervention.",
    color: "#10b981",
  },
  {
    id: "evidence",
    n: "3",
    title: "Evidence Review",
    blurb: "Inspect evidence age and confirm what is safe to communicate.",
    color: "#facc15",
  },
];

let logSeq = 0;

export interface SimulationState {
  mode: SimulationMode;
  view: ViewMode;
  /** Kept across drill resets so a player's choice sticks. */
  cameraMode: CameraMode;
  air: number;
  smokeIntensity: number;
  hazardElapsed: number;
  routeBlocked: boolean;
  routeStatus: RouteCondition;
  playerPos: Vec3;
  stamina: number;
  sector: RoomId;
  explored: Partial<Record<RoomId, boolean>>;
  evidence: Record<string, EvidenceRecord>;
  latestMessage: RouteMessage | null;
  lastAcknowledgement: CommandAcknowledgement | null;
  interventionApplied: boolean;
  assemblyProgress: number;
  assemblyConfirmed: boolean;
  failed: boolean;
  prompt: string | null;
  resetSeq: number;
  log: LogEntry[];

  navEdges: Record<string, NavigationEdge>;
  navPath: NavigationNode[];
  targetExit: "assembly-a" | "assembly-b" | null;
  optimalEgressDistance: number;
  navSafetyRating: "safe" | "caution" | "critical";

  maya: MayaState;
  mayaOutcome: MayaOutcome;
  mayaAssisted: boolean;
  mayaAbandoned: boolean;

  setMode: (mode: SimulationMode) => void;
  setView: (view: ViewMode) => void;
  toggleCameraMode: () => void;
  setPrompt: (prompt: string | null) => void;
  enterSector: (sector: RoomId) => void;
  updateNavPosition: (pos: Vec3) => void;
  updateNavEdge: (edgeId: string, updates: Partial<NavigationEdge>) => void;
  applySmokeExposure: (
    elapsedSeconds: number,
    intensity: number,
    dt: number,
  ) => void;
  receiveRouteMessage: (message: RouteMessage) => void;
  receiveAcknowledgement: (acknowledgement: CommandAcknowledgement) => void;
  applyIntervention: () => void;
  assistMaya: () => void;
  abandonMaya: () => void;
  updateMaya: (updater: (prev: MayaState) => MayaState) => void;
  confirmAssembly: () => void;
  fail: (reason: string) => void;
  push: (text: string, tone?: LogEntry["tone"]) => void;
  reset: () => void;
  applyWardenState: (state: WardenState) => void;
}

const initial = {
  air: 100,
  smokeIntensity: 0,
  hazardElapsed: 0,
  routeBlocked: false,
  routeStatus: "CLEAR" as RouteCondition,
  playerPos: EVACUEE_SPAWN,
  stamina: 100,
  sector: "classroom-204" as RoomId,
  explored: { "classroom-204": true } as Partial<Record<RoomId, boolean>>,
  evidence: {} as Record<string, EvidenceRecord>,
  latestMessage: null as RouteMessage | null,
  lastAcknowledgement: null as CommandAcknowledgement | null,
  interventionApplied: false,
  assemblyProgress: 0,
  assemblyConfirmed: false,
  failed: false,
  prompt: null as string | null,
  maya: createInitialMayaState(),
  mayaOutcome: "unmet" as MayaOutcome,
  mayaAssisted: false,
  mayaAbandoned: false,
  log: [] as LogEntry[],
};

const defaultEdgesRecord: Record<string, NavigationEdge> = Object.fromEntries(
  NAV_EDGES.map((e) => [e.id, e]),
);
const initialNav = findSafestExit(EVACUEE_SPAWN, defaultEdgesRecord);

export const useSimulation = create<SimulationState>()((set, get) => ({
  mode: { kind: "solo" },
  view: "evacuee",
  cameraMode: "third",
  resetSeq: 0,
  ...initial,
  navEdges: defaultEdgesRecord,
  navPath: initialNav.path.nodes,
  targetExit: initialNav.target,
  optimalEgressDistance: initialNav.path.totalDistance,
  navSafetyRating: initialNav.path.safetyRating,

  setMode: (mode) =>
    set({
      mode,
      view:
        mode.kind === "evacuee"
          ? "evacuee"
          : mode.kind === "warden"
            ? "warden"
            : get().view,
    }),

  setView: (view) => set({ view }),

  toggleCameraMode: () =>
    set((state) => ({ cameraMode: state.cameraMode === "third" ? "first" : "third" })),

  setPrompt: (prompt) => set((state) => (state.prompt === prompt ? state : { prompt })),

  push: (text, tone = "info") =>
    set((state) => {
      if (state.log[0]?.text === text && state.log[0]?.tone === tone) return state;
      return { log: [{ id: ++logSeq, text, tone }, ...state.log].slice(0, 6) };
    }),

  enterSector: (sector) => {
    if (get().sector === sector) return;
    const first = !get().explored[sector];
    set((state) => ({
      sector,
      explored: { ...state.explored, [sector]: true },
    }));
    if (first) get().push(`Entered ${sectorLabel(sector)}`, "info");
  },

  updateNavPosition: (pos) => {
    const state = get();
    const result = findSafestExit(pos, state.navEdges);
    set({
      playerPos: pos,
      navPath: result.path.nodes,
      targetExit: result.target,
      optimalEgressDistance: result.path.totalDistance,
      navSafetyRating: result.path.safetyRating,
    });
  },

  updateNavEdge: (edgeId, updates) => {
    const state = get();
    const currentEdge = state.navEdges[edgeId];
    if (!currentEdge) return;
    const nextEdges = {
      ...state.navEdges,
      [edgeId]: { ...currentEdge, ...updates },
    };
    set({ navEdges: nextEdges });
  },

  applySmokeExposure: (elapsedSeconds, intensity, dt) => {
    const state = get();
    const nextIntensity = Math.max(0, Math.min(1, intensity));
    const safeDt = Math.max(0, Math.min(0.25, dt));
    const airDrainRate = calculateAirDrainRate(nextIntensity);
    const airBefore = state.air;
    const hazardBefore = state.smokeIntensity;
    const air = Math.max(0, airBefore - airDrainRate * safeDt);

    const eastSmoke = Math.max(
      getSectorSmoke("corridor-east", elapsedSeconds, state.interventionApplied),
      getSectorSmoke("stair-east", elapsedSeconds, state.interventionApplied),
    );
    const classification = classifyHazard(eastSmoke);
    const routeBlocked = classification === "BLOCKED";
    const routeStatus: RouteCondition = state.interventionApplied
      ? "INTERVENED"
      : classification;

    const navEdges = { ...state.navEdges };
    let edgesUpdated = false;
    if (routeBlocked && navEdges["edge-corre-staire-entry"]?.status !== "blocked") {
      navEdges["edge-corre-staire-entry"] = {
        ...navEdges["edge-corre-staire-entry"],
        status: "blocked",
      };
      navEdges["edge-staire-entry-landing"] = {
        ...navEdges["edge-staire-entry-landing"],
        status: "blocked",
      };
      edgesUpdated = true;
    } else if (!routeBlocked && navEdges["edge-corre-staire-entry"]?.status === "blocked") {
      navEdges["edge-corre-staire-entry"] = {
        ...navEdges["edge-corre-staire-entry"],
        status: "open",
      };
      navEdges["edge-staire-entry-landing"] = {
        ...navEdges["edge-staire-entry-landing"],
        status: "open",
      };
      edgesUpdated = true;
    }

    let navUpdates = {};
    if (edgesUpdated) {
      const pos = state.playerPos ?? EVACUEE_SPAWN;
      const navResult = findSafestExit(pos, navEdges);
      navUpdates = {
        navEdges,
        navPath: navResult.path.nodes,
        targetExit: navResult.target,
        optimalEgressDistance: navResult.path.totalDistance,
        navSafetyRating: navResult.path.safetyRating,
      };
    }

    set({
      hazardElapsed: Math.max(0, elapsedSeconds),
      smokeIntensity: nextIntensity,
      routeBlocked,
      routeStatus,
      air,
      ...navUpdates,
    });

    if (
      hazardBefore < SMOKE_EXPOSURE_THRESHOLD &&
      nextIntensity >= SMOKE_EXPOSURE_THRESHOLD
    ) {
      get().push("Smoke observed. Move toward clear air.", "bad");
    }
    if (state.routeStatus !== "CAUTION" && routeStatus === "CAUTION") {
      get().push("Caution: Light smoke spreading toward East exit.", "bad");
    }
    if (state.routeStatus !== "DANGEROUS" && routeStatus === "DANGEROUS") {
      get().push("Danger: Dense smoke accumulating in East corridor.", "bad");
    }
    if (!state.routeBlocked && routeBlocked) {
      get().push("East route is BLOCKED by fire & toxic smoke. Rerouting via West exit.", "bad");
    }
    if (airBefore >= 35 && air < 35) {
      get().push("Air is getting thin. Move toward clear air.", "bad");
    }
    if (air === 0 && airBefore > 0) get().fail("air threshold reached");
  },

  receiveRouteMessage: (message) => {
    set({ latestMessage: message });
    get().push(message.caption, "good");
  },

  receiveAcknowledgement: (acknowledgement) => {
    set({ lastAcknowledgement: acknowledgement });
    if (!acknowledgement.accepted)
      get().push(`Action denied: ${acknowledgement.reason ?? "not available"}.`, "bad");
  },

  applyIntervention: () => {
    set({ interventionApplied: true, routeStatus: "INTERVENED" });
    get().push("Ventilation override accepted. Smoke is dispersing.", "good");
  },

  assistMaya: () => {
    const state = get();
    if (state.maya.status === "SAFE" || state.maya.status === "INCAPACITATED") return;
    const nextMaya = transitionMaya(
      state.maya,
      { type: "assisted" },
      {
        elapsedSeconds: state.hazardElapsed,
        playerPos: state.playerPos ?? EVACUEE_SPAWN,
        localSmoke: state.smokeIntensity,
      },
    );
    set({ maya: nextMaya, mayaAssisted: true, mayaOutcome: "in-transit" });
    get().push("Assisting Maya: Peer following your safe egress path.", "good");
    if (nextMaya.dialogue) get().push(`Maya: "${nextMaya.dialogue}"`, "info");
  },

  abandonMaya: () => {
    const state = get();
    if (state.mayaAbandoned || state.maya.status === "SAFE") return;
    const nextMaya = transitionMaya(
      state.maya,
      { type: "abandoned" },
      {
        elapsedSeconds: state.hazardElapsed,
        playerPos: state.playerPos ?? EVACUEE_SPAWN,
        localSmoke: state.smokeIntensity,
      },
    );
    set({ maya: nextMaya, mayaAbandoned: true, mayaOutcome: "abandoned" });
    get().push("Decision recorded: Maya left behind in the facility.", "bad");
    if (nextMaya.dialogue) get().push(`Maya: "${nextMaya.dialogue}"`, "bad");
  },

  updateMaya: (updater) => {
    const state = get();
    const nextMaya = updater(state.maya);
    let mayaOutcome = state.mayaOutcome;
    if (nextMaya.status === "SAFE") mayaOutcome = "saved";
    else if (nextMaya.status === "ABANDONED") mayaOutcome = "abandoned";
    else if (nextMaya.status === "INCAPACITATED") mayaOutcome = "incapacitated";
    set({ maya: nextMaya, mayaOutcome });
  },

  confirmAssembly: () => {
    const state = get();
    if (state.failed || state.assemblyConfirmed) return;
    const mayaSaved =
      state.maya.status === "SAFE" ||
      (state.mayaAssisted && state.maya.distanceToPlayer < 6.0);
    const mayaOutcome: MayaOutcome = mayaSaved
      ? "saved"
      : state.mayaAbandoned
        ? "abandoned"
        : state.mayaAssisted
          ? "in-transit"
          : "unmet";
    set({
      assemblyConfirmed: true,
      assemblyProgress: 1,
      mayaOutcome,
      ...(mayaSaved ? { maya: { ...state.maya, status: "SAFE" as const } } : {}),
    });
    get().push(
      mayaSaved
        ? "Assembly confirmed with peer Maya rescued! Training outcome recorded."
        : "Assembly confirmed. Training outcome recorded.",
      "good",
    );
  },

  fail: (reason) => {
    if (get().failed || get().assemblyConfirmed) return;
    set({ failed: true });
    get().push(`Training outcome recorded: ${reason}.`, "bad");
  },

  reset: () => {
    logSeq = 0;
    set((state) => ({
      ...initial,
      maya: createInitialMayaState(),
      resetSeq: state.resetSeq + 1,
    }));
  },

  applyWardenState: (state) => {
    const evidence = Object.fromEntries(state.evidence.map((item) => [item.id, item]));
    set({
      air: state.air,
      smokeIntensity: state.smokeIntensity,
      routeBlocked: state.routeStatus === "unsafe" || state.routeStatus === "BLOCKED",
      routeStatus: state.routeStatus,
      sector: state.evacuee?.sectorId ?? get().sector,
      interventionApplied: state.interventionApplied,
      assemblyProgress: state.assemblyProgress,
      assemblyConfirmed: state.assemblyConfirmed,
      failed: state.failed,
      evidence,
      latestMessage: state.latestMessage,
      lastAcknowledgement: state.lastAcknowledgement,
      log: state.log,
    });
  },
}));

function sectorLabel(sector: RoomId) {
  return (
    {
      "classroom-204": "Classroom 204",
      "classroom-205": "Classroom 205",
      "workshop-203": "Workshop 203",
      "lab-201": "Lab 201 (Nanotech)",
      "lab-202": "Lab 202 (Organic Chem)",
      "chem-store": "Chemical Store",
      "prep-room": "Prep Room",
      "corridor-west": "the West Corridor",
      "junction-center": "the Central Junction",
      "corridor-east": "the East Corridor",
      "stair-west": "the West Stairwell",
      "stair-east": "the East Stairwell",
      "assembly-a": "Assembly Area A (West)",
      "assembly-b": "Assembly Area B (East)",
      outside: "the campus grounds",
    }[sector] ?? sector
  );
}

/** Wardens follow the evacuee through the whole block; solo reveals sectors as they are explored. */
export function useSectorVisible(sector: RoomId): boolean {
  const warden = useSimulation((state) => state.mode.kind === "warden");
  const explored = useSimulation((state) => !!state.explored[sector]);
  return warden || explored;
}

export const watchedSector = (mode: SimulationMode): RoomId | null =>
  mode.kind === "warden" ? mode.sectorId : null;

/** The evacuee and solo practice own local movement and deterministic fallback simulation. */
export const useIsSimulationOwner = () =>
  useSimulation((state) => state.mode.kind === "solo" || state.mode.kind === "evacuee");
