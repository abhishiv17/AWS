"use client";

import { create } from "zustand";
import type { RoomId } from "./level";
import type { Snapshot } from "./net/types";
import type { CommandCode } from "./commands";
import {
  AIR_DRAIN_PER_SECOND,
  HAZARD_EXPOSURE_PER_SECOND,
  BLOCKED_ROUTE,
  SMOKE_EXPOSURE_THRESHOLD,
  VENTILATION_SMOKE_FACTOR,
  getSectorSmoke,
  isRouteBlocked,
} from "./smoke";

/**
 * Internal view identifiers.
 *
 * The string values "thief" and "spectator" are wire-format constants shared
 * with SpacetimeDB and must not be renamed. UI-facing labels live in VIEWS.
 */
export type ViewMode = "thief" | "spectator" | "discovery";

/**
 * How this client is taking part.
 * - solo: sandbox, you drive the evacuee and may inspect all three views
 * - thief: wire-format role for the active evacuee
 * - spectator: wire-format role for a warden posted to exactly one sector
 */
export type GameMode =
  | { kind: "solo" }
  | { kind: "thief" }
  | { kind: "spectator"; watching: RoomId };

export const VIEWS: {
  id: ViewMode;
  n: string;
  title: string;
  blurb: string;
  color: string;
}[] = [
  {
    id: "thief",
    n: "1",
    title: "Evacuee View",
    blurb: "Only sees immediate conditions and route-level guidance.",
    color: "#4aa8ff",
  },
  {
    id: "spectator",
    n: "2",
    title: "Warden Station",
    blurb: "Sector evidence, verification, and bounded intervention.",
    color: "#39ff88",
  },
  {
    id: "discovery",
    n: "3",
    title: "Warden — Evidence Scan",
    blurb: "Reveals unverified hazards, clues, and safety resources.",
    color: "#ffd23b",
  },
];

export interface LogEntry {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

export interface CommandTransmission {
  id: number;
  code: CommandCode;
  by: string;
  at: number;
}

let logSeq = 0;

export interface GameState {
  mode: GameMode;
  view: ViewMode;
  hp: number;
  alarm: number;
  /** current sector smoke, kept separate from the cumulative hazard level */
  smokeIntensity: number;
  /** seconds since the active drill began */
  hazardElapsed: number;
  /** whether the authored east route has become unsafe */
  routeBlocked: boolean;
  spotted: boolean;
  room: RoomId;
  /** evacuee position on the floorplan, for the minimap (~10 Hz) */
  thiefXZ: [number, number];
  /** authoritative evacuee facing, in radians; +Z points south on the map */
  thiefYaw: number;
  explored: Partial<Record<RoomId, boolean>>;
  discovered: Record<string, boolean>;
  collected: Record<string, boolean>;
  keycard: boolean;
  doorsOpen: Record<string, boolean>;
  alarmDisabled: boolean;
  codeFound: boolean;
  vaultOpen: boolean;
  /** the keypad has released the extraction vent */
  ventOpen: boolean;
  escaped: boolean;
  /** how the run ended, for the win card */
  escapedVia: "entrance" | "vent" | null;
  loot: number;
  score: number;
  prompt: string | null;
  resetSeq: number;
  log: LogEntry[];
  lastCommand: CommandTransmission | null;
  intelPoints: number;
  invisibleUntil: number;

  setMode: (m: GameMode) => void;
  setView: (v: ViewMode) => void;
  setPrompt: (p: string | null) => void;
  setThiefXZ: (x: number, z: number) => void;
  enterRoom: (room: RoomId) => void;
  damage: (n: number, reason: string) => void;
  drain: (n: number) => void;
  heal: (n: number, reason: string) => void;
  setAlarm: (v: number, spotted: boolean) => void;
  /** Tick the local smoke field and apply its light pressure model. */
  applySmokeExposure: (elapsedSeconds: number, intensity: number, dt: number) => void;
  discover: (id: string, label: string) => void;
  collect: (id: string, label: string, value?: number) => void;
  openDoor: (id: string) => void;
  disableAlarm: () => void;
  tryKeypad: () => void;
  escape: (via?: "entrance" | "vent") => void;
  /** Space pressed while standing in the extraction vent. */
  ventExit: () => void;
  push: (text: string, tone?: LogEntry["tone"]) => void;
  receiveCommand: (code: CommandCode, by: string, at?: number) => void;
  reset: () => void;
  /** wardens mirror the evacuee client's world */
  applySnapshot: (s: Snapshot) => void;
  addIntel: (n: number) => void;
  spendIntel: (n: number) => void;
  applyPowerUp: (effect: "heal" | "invis", by: string) => void;
}

const initial = {
  hp: 100,
  alarm: 0,
  smokeIntensity: 0,
  hazardElapsed: 0,
  routeBlocked: false,
  spotted: false,
  room: "outside" as RoomId,
  thiefXZ: [0, 15.5] as [number, number],
  thiefYaw: 0,
  explored: { outside: true, entry: true } as Partial<Record<RoomId, boolean>>,
  discovered: {} as Record<string, boolean>,
  collected: {} as Record<string, boolean>,
  keycard: false,
  doorsOpen: {} as Record<string, boolean>,
  alarmDisabled: false,
  codeFound: false,
  vaultOpen: false,
  ventOpen: false,
  escaped: false,
  escapedVia: null as "entrance" | "vent" | null,
  loot: 0,
  score: 0,
  prompt: null as string | null,
  log: [] as LogEntry[],
  lastCommand: null as CommandTransmission | null,
  intelPoints: 0,
  invisibleUntil: 0,
};

export const useGame = create<GameState>()((set, get) => ({
  mode: { kind: "solo" },
  view: "thief",
  resetSeq: 0,
  ...initial,

  setMode: (mode) =>
    set({
      mode,
      view:
        mode.kind === "thief"
          ? "thief"
          : mode.kind === "spectator"
            ? "spectator"
            : get().view,
    }),

  setView: (view) => set({ view }),

  setPrompt: (prompt) => set((s) => (s.prompt === prompt ? s : { prompt })),

  setThiefXZ: (x, z) =>
    set((s) =>
      Math.abs(s.thiefXZ[0] - x) < 0.05 && Math.abs(s.thiefXZ[1] - z) < 0.05
        ? s
        : { thiefXZ: [x, z] },
    ),

  push: (text, tone = "info") =>
    set((s) => {
      if (s.log[0]?.text === text && s.log[0]?.tone === tone) return s;
      return { log: [{ id: ++logSeq, text, tone }, ...s.log].slice(0, 6) };
    }),

  receiveCommand: (code, by, at = Date.now()) =>
    set({ lastCommand: { id: at, code, by, at } }),

  enterRoom: (room) => {
    if (get().room === room) return;
    const first = !get().explored[room];
    set((s) => ({ room, explored: { ...s.explored, [room]: true } }));
    if (first) {
      const named: Partial<Record<RoomId, string>> = {
         lobby: "the Central Lobby",
          sec: "the Control Sector",
          vault: "the Archives Sector",
          annex: "the Exit Annex",
        };
        if (named[room]) get().push(`Entered ${named[room]}`, "info");
    }
  },

  damage: (n, reason) => {
    const hp = Math.max(0, get().hp - n);
    set({ hp });
    get().push(`-${Math.round(n)} AIR - ${reason}`, "bad");
     if (hp === 0) get().push("Air quality critical — drill ended.", "bad");
  },

  drain: (n) => {
    const before = get().hp;
    const hp = Math.max(0, before - n);
    set({ hp });
    if (hp === 0 && before > 0)
        get().push("Air quality critical — drill ended.", "bad");
  },

  heal: (n, reason) => {
    set({ hp: Math.min(100, get().hp + n) });
    get().push(`+${n} AIR - ${reason}`, "good");
  },

  setAlarm: (alarm, spotted) => {
    const was = get().spotted;
    set({ alarm: Math.max(0, Math.min(100, alarm)), spotted });
      if (spotted && !was) get().push("Hazard exposure detected!", "bad");
  },

  applySmokeExposure: (elapsedSeconds, intensity, dt) => {
    const state = get();
    const nextIntensity = Math.max(0, Math.min(1, intensity));
    const safeDt = Math.max(0, Math.min(0.25, dt));
    const exposureIntensity =
      nextIntensity > SMOKE_EXPOSURE_THRESHOLD ? nextIntensity : 0;
    const routeBlocked = isRouteBlocked(
      BLOCKED_ROUTE.from,
      BLOCKED_ROUTE.to,
      elapsedSeconds,
    );
    const hpBefore = state.hp;
    const alarmBefore = state.alarm;
    const hp = Math.max(
      0,
      hpBefore - exposureIntensity * AIR_DRAIN_PER_SECOND * safeDt,
    );
    const alarm = Math.min(
      100,
      alarmBefore + exposureIntensity * HAZARD_EXPOSURE_PER_SECOND * safeDt,
    );

    set({
      hazardElapsed: Math.max(0, elapsedSeconds),
      smokeIntensity: nextIntensity,
      routeBlocked,
      hp,
      alarm,
    });

    if (
      state.smokeIntensity <= SMOKE_EXPOSURE_THRESHOLD &&
      nextIntensity > SMOKE_EXPOSURE_THRESHOLD
    )
      get().push("Smoke detected — move toward clear air.", "bad");
    if (!state.routeBlocked && routeBlocked)
      get().push("East route is unsafe — use the west route.", "bad");
    if (alarmBefore < 65 && alarm >= 65)
      get().push("Hazard level rising — route guidance needed.", "bad");
    if (hpBefore >= 35 && hp < 35)
      get().push("Air quality low — move toward clear air.", "bad");
    if (hp === 0 && hpBefore > 0)
      get().push("Air quality critical — drill ended.", "bad");
  },

  discover: (id, label) => {
    if (get().discovered[id]) return;
    set((s) => ({
      discovered: { ...s.discovered, [id]: true },
      score: s.score + 50,
      codeFound: s.codeFound || id === "note",
    }));
    get().push(`Discovered: ${label}`, "good");
    if (id === "note")
        get().push("Route code verified and relayed: 4-7-1-2", "good");
  },

  collect: (id, label, value = 0) => {
    if (get().collected[id]) return;
    set((s) => ({
      collected: { ...s.collected, [id]: true },
      loot: s.loot + value,
      score: s.score + value,
      keycard: s.keycard || id === "keycard",
    }));
    get().push(`Picked up: ${label}`, "good");
  },

  openDoor: (id) =>
    set((s) =>
      s.doorsOpen[id] ? s : { doorsOpen: { ...s.doorsOpen, [id]: true } },
    ),

  disableAlarm: () => {
    if (get().alarmDisabled) return;
    set((s) => ({ alarmDisabled: true, alarm: 0, score: s.score + 100 }));
    get().push("Ventilation override active. Smoke dispersal engaged.", "good");
  },

  /**
   * The emergency panel by the exit — one step that opens the way out.
   *
   * It takes the access key from the control sector, or the 4-digit route
   * code if the warden read the note. Accepting it releases the service
   * exit, so an evacuee who got this far always has a clear way to finish.
   */
  tryKeypad: () => {
    const s = get();
    if (s.vaultOpen) return;
    if (!s.keycard && !s.codeFound) {
      s.push(
          "Emergency panel locked. Locate the access key in the control sector.",
        "bad",
      );
      return;
    }
    set({ vaultOpen: true, ventOpen: true, score: s.score + 250 });
    s.push(
      s.codeFound
          ? "Route code accepted — exit unlocked, service route released."
          : "Access key accepted — exit unlocked, service route released.",
       "good",
    );
      s.push("Follow the marked service exit to the assembly point.", "info");
  },

  escape: (via = "entrance") => {
    const s = get();
    if (s.escaped) return;
    const withLoot = !!s.collected["vault-loot"];
    set({ escaped: true, escapedVia: via, score: s.score + (withLoot ? 500 : 200) });
    get().push(
      via === "vent"
           ? withLoot
            ? "Assembly reached via service exit — supplies secured. Drill complete."
            : "Assembly reached via service exit. Drill complete."
          : "Assembly reached — supplies secured. Drill complete.",
      "good",
    );
  },

  /**
   * The service exit is the way this drill ends.
   *
   * The exit only appears once a warden has verified it, so reaching this
   * point already required coordination. Securing optional supplies is useful
   * but not required for a safe evacuation.
   */
  ventExit: () => {
    const s = get();
    if (s.escaped || s.hp <= 0) return;
    s.escape("vent");
  },

  reset: () => {
    logSeq = 0;
    set((s) => ({ ...initial, resetSeq: s.resetSeq + 1 }));
  },

  addIntel: (n) => set((s) => ({ intelPoints: s.intelPoints + n })),

  // charging for a support action only; the caller sends the net message that makes
  // it happen, so a warden with too few points never fires one off
  spendIntel: (n) => {
    const s = get();
    if (s.intelPoints >= n) set({ intelPoints: s.intelPoints - n });
  },

  applyPowerUp: (effect, by) => {
    if (effect === "heal") {
      get().heal(25, `Power-up from ${by}`);
    } else if (effect === "invis") {
      set({ invisibleUntil: Date.now() + 10000 });
        get().push(`Safe passage (10 s) active — support from ${by}`, "good");
    }
  },

  applySnapshot: (snap) => {
    const toMap = (ids: string[]) =>
      Object.fromEntries(ids.map((i) => [i, true]));
    const hazardElapsed = snap.hazardElapsed ?? get().hazardElapsed;
    const routeBlocked = isRouteBlocked(
      BLOCKED_ROUTE.from,
      BLOCKED_ROUTE.to,
      hazardElapsed,
    );
    set({
      hp: snap.hp,
      alarm: snap.alarm,
      hazardElapsed,
      routeBlocked,
      smokeIntensity:
        getSectorSmoke(snap.room, hazardElapsed) *
        (snap.alarmDisabled ? VENTILATION_SMOKE_FACTOR : 1),
      spotted: snap.spotted,
      room: snap.room,
      thiefXZ: [snap.thief[0], snap.thief[2]],
      thiefYaw: snap.thief[3],
      keycard: snap.keycard,
      codeFound: snap.codeFound,
      vaultOpen: snap.vaultOpen,
      ventOpen: snap.ventOpen,
      alarmDisabled: snap.alarmDisabled,
      escaped: snap.escaped,
      loot: snap.loot,
      score: snap.score,
      collected: toMap(snap.collected),
      discovered: toMap(snap.discovered),
      doorsOpen: toMap(snap.doorsOpen),
      explored: toMap(snap.explored) as Partial<Record<RoomId, boolean>>,
      log: snap.log,
    });
  },
}));

/** Does this client get to see inside the given sector? */
export function useRoomVisible(room: RoomId): boolean {
  const mode = useGame((s) => s.mode);
  const explored = useGame((s) => !!s.explored[room]);
  // a warden sees exactly the one sector they were posted to
  if (mode.kind === "spectator") return mode.watching === room;
  return explored;
}

/** The one sector this warden was posted to. */
export const watchedRoom = (mode: GameMode): RoomId | null =>
  mode.kind === "spectator" ? mode.watching : null;

/** This client owns the simulation (evacuee input, hazards, detection). */
export const useIsHost = () =>
  useGame((s) => s.mode.kind === "solo" || s.mode.kind === "thief");
