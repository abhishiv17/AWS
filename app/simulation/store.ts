"use client";

import { create } from "zustand";
import type { RoomId } from "./level";
import {
  BLOCKED_ROUTE,
  AIR_DRAIN_PER_SECOND,
  SMOKE_EXPOSURE_THRESHOLD,
  isRouteBlocked,
} from "./smoke";
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
  routeStatus: "clear" | "unsafe" | "intervened";
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

  setMode: (mode: SimulationMode) => void;
  setView: (view: ViewMode) => void;
  toggleCameraMode: () => void;
  setPrompt: (prompt: string | null) => void;
  enterSector: (sector: RoomId) => void;
  applySmokeExposure: (
    elapsedSeconds: number,
    intensity: number,
    dt: number,
  ) => void;
  receiveRouteMessage: (message: RouteMessage) => void;
  receiveAcknowledgement: (acknowledgement: CommandAcknowledgement) => void;
  applyIntervention: () => void;
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
  routeStatus: "clear" as const,
  stamina: 100,
  sector: "outside" as RoomId,
  explored: { outside: true, entry: true } as Partial<Record<RoomId, boolean>>,
  evidence: {} as Record<string, EvidenceRecord>,
  latestMessage: null as RouteMessage | null,
  lastAcknowledgement: null as CommandAcknowledgement | null,
  interventionApplied: false,
  assemblyProgress: 0,
  assemblyConfirmed: false,
  failed: false,
  prompt: null as string | null,
  log: [] as LogEntry[],
};

export const useSimulation = create<SimulationState>()((set, get) => ({
  mode: { kind: "solo" },
  view: "evacuee",
  cameraMode: "third",
  resetSeq: 0,
  ...initial,

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

  applySmokeExposure: (elapsedSeconds, intensity, dt) => {
    const state = get();
    const nextIntensity = Math.max(0, Math.min(1, intensity));
    const safeDt = Math.max(0, Math.min(0.25, dt));
    const exposure = nextIntensity > SMOKE_EXPOSURE_THRESHOLD ? nextIntensity : 0;
    const routeBlocked = isRouteBlocked(
      BLOCKED_ROUTE.from,
      BLOCKED_ROUTE.to,
      elapsedSeconds,
    );
    const airBefore = state.air;
    const hazardBefore = state.smokeIntensity;
    const air = Math.max(0, airBefore - exposure * AIR_DRAIN_PER_SECOND * safeDt);
    const routeStatus = state.interventionApplied
      ? "intervened"
      : routeBlocked
        ? "unsafe"
        : "clear";

    set({
      hazardElapsed: Math.max(0, elapsedSeconds),
      smokeIntensity: nextIntensity,
      routeBlocked,
      routeStatus,
      air,
    });

    if (
      hazardBefore <= SMOKE_EXPOSURE_THRESHOLD &&
      nextIntensity > SMOKE_EXPOSURE_THRESHOLD
    )
      get().push("Smoke observed. Move toward clear air.", "bad");
    if (!state.routeBlocked && routeBlocked)
      get().push("East route is unsafe. Await or follow verified west guidance.", "bad");
    if (airBefore >= 35 && air < 35)
      get().push("Air is getting thin. Move toward clear air.", "bad");
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
    set({ interventionApplied: true, routeStatus: "intervened" });
    get().push("Ventilation override accepted. Smoke is dispersing.", "good");
  },

  confirmAssembly: () => {
    if (get().failed || get().assemblyConfirmed) return;
    set({ assemblyConfirmed: true, assemblyProgress: 1 });
    get().push("Assembly confirmed. Training outcome recorded.", "good");
  },

  fail: (reason) => {
    if (get().failed || get().assemblyConfirmed) return;
    set({ failed: true });
    get().push(`Training outcome recorded: ${reason}.`, "bad");
  },

  reset: () => {
    logSeq = 0;
    set((state) => ({ ...initial, resetSeq: state.resetSeq + 1 }));
  },

  applyWardenState: (state) => {
    const evidence = Object.fromEntries(state.evidence.map((item) => [item.id, item]));
    set({
      air: state.air,
      smokeIntensity: state.smokeIntensity,
      routeBlocked: state.routeStatus === "unsafe",
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
  return {
    outside: "the outdoor assembly court",
    entry: "the main foyer",
    lobby: "the corridor junction",
    wcorr: "the west stair",
    ecorr: "the east stair",
    sec: "the lab and utility sector",
    vault: "the dorm wing",
    annex: "the electrical service area",
  }[sector];
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
