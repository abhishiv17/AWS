"use client";

import { create } from "zustand";
import type { RoomId } from "./level";
import {
  BLOCKED_ROUTE,
  AIR_DRAIN_PER_SECOND,
  SMOKE_EXPOSURE_THRESHOLD,
  VENTILATION_SMOKE_FACTOR,
  getSectorSmoke,
  isRouteBlocked,
} from "./smoke";
import type {
  CommandAcknowledgement,
  EvacueeState,
  EvidenceRecord,
  LogEntry,
  RouteMessage,
  WardenState,
} from "./net/types";

export type ViewMode = "evacuee" | "warden" | "evidence";

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
  air: number;
  smokeIntensity: number;
  hazardElapsed: number;
  routeBlocked: boolean;
  routeStatus: "clear" | "unsafe" | "intervened";
  stamina: number;
  sector: RoomId;
  evacueeXZ: [number, number];
  evacueeYaw: number;
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
  setPrompt: (prompt: string | null) => void;
  setEvacueeXZ: (x: number, z: number) => void;
  setEvacueeYaw: (yaw: number) => void;
  setStamina: (stamina: number) => void;
  enterSector: (sector: RoomId) => void;
  applySmokeExposure: (
    elapsedSeconds: number,
    intensity: number,
    dt: number,
  ) => void;
  observeEvidence: (evidence: EvidenceRecord) => void;
  verifyEvidence: (evidenceId: string) => void;
  receiveRouteMessage: (message: RouteMessage) => void;
  receiveAcknowledgement: (acknowledgement: CommandAcknowledgement) => void;
  applyIntervention: () => void;
  updateAssemblyProgress: (progress: number) => void;
  confirmAssembly: () => void;
  fail: (reason: string) => void;
  push: (text: string, tone?: LogEntry["tone"]) => void;
  reset: () => void;
  applyEvacueeState: (state: EvacueeState) => void;
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
  evacueeXZ: [0, 9] as [number, number],
  evacueeYaw: 0,
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

  setPrompt: (prompt) => set((state) => (state.prompt === prompt ? state : { prompt })),

  setEvacueeXZ: (x, z) =>
    set((state) =>
      Math.abs(state.evacueeXZ[0] - x) < 0.05 &&
      Math.abs(state.evacueeXZ[1] - z) < 0.05
        ? state
        : { evacueeXZ: [x, z] },
    ),

  setEvacueeYaw: (evacueeYaw) => set({ evacueeYaw }),

  setStamina: (stamina) => set({ stamina: Math.max(0, Math.min(100, stamina)) }),

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

  observeEvidence: (evidence) =>
    set((state) => ({
      evidence: {
        ...state.evidence,
        [evidence.id]: {
          ...evidence,
          status: evidence.status === "UNKNOWN" ? "OBSERVED" : evidence.status,
          observedAt: evidence.observedAt ?? Date.now(),
          updatedAt: Date.now(),
        },
      },
    })),

  verifyEvidence: (evidenceId) =>
    set((state) => {
      const evidence = state.evidence[evidenceId];
      if (!evidence || evidence.status === "EXPIRED") return state;
      return {
        evidence: {
          ...state.evidence,
          [evidenceId]: {
            ...evidence,
            status: "VERIFIED",
            verifiedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };
    }),

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

  updateAssemblyProgress: (assemblyProgress) =>
    set({ assemblyProgress: Math.max(0, Math.min(1, assemblyProgress)) }),

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

  applyEvacueeState: (state) => {
    set({
      air: state.air,
      smokeIntensity: state.smokeIntensity,
      hazardElapsed: state.hazardElapsed,
      routeBlocked: state.routeStatus === "unsafe",
      routeStatus: state.routeStatus,
      stamina: state.stamina,
      sector: state.sectorId,
      evacueeXZ: [state.position[0], state.position[2]],
      evacueeYaw: state.position[3],
      interventionApplied: state.interventionApplied,
      assemblyProgress: state.assemblyProgress,
      assemblyConfirmed: state.assemblyConfirmed,
      failed: state.failed,
      latestMessage: state.routeMessage,
      log: state.log,
    });
  },

  applyWardenState: (state) => {
    const evidence = Object.fromEntries(state.evidence.map((item) => [item.id, item]));
    set({
      air: state.air,
      smokeIntensity: state.smokeIntensity,
      routeBlocked: state.routeStatus === "unsafe",
      routeStatus: state.routeStatus,
      sector: state.evacuee?.sectorId ?? get().sector,
      evacueeXZ: state.evacuee
        ? [state.evacuee.position[0], state.evacuee.position[2]]
        : get().evacueeXZ,
      evacueeYaw: state.evacuee?.position[3] ?? get().evacueeYaw,
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

/** Only the assigned warden sector is visible outside solo practice. */
export function useSectorVisible(sector: RoomId): boolean {
  const mode = useSimulation((state) => state.mode);
  const explored = useSimulation((state) => !!state.explored[sector]);
  if (mode.kind === "warden") return mode.sectorId === sector;
  return explored;
}

export const watchedSector = (mode: SimulationMode): RoomId | null =>
  mode.kind === "warden" ? mode.sectorId : null;

/** The evacuee and solo practice own local movement and deterministic fallback simulation. */
export const useIsSimulationOwner = () =>
  useSimulation((state) => state.mode.kind === "solo" || state.mode.kind === "evacuee");

export function wardenSmoke(state: WardenState) {
  return state.smokeIntensity * (state.interventionApplied ? VENTILATION_SMOKE_FACTOR : 1);
}

export { getSectorSmoke };
