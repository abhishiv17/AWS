"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COMMANDS, commandByCode, type CommandCode } from "./commands";
import Minimap from "./components/Minimap";
import { clearVoiceQueue, enqueueVoice, playNarrationOnce, playSignal } from "./audio";
import { channelOpen, commandChannel, MARKERS, roomById } from "./level";
import {
  BLOCKED_ROUTE,
  getSectorSmoke,
  getSmokeSource,
  isRouteBlocked,
  smokeBand,
  SMOKE_EXPOSURE_THRESHOLD,
  VENTILATION_SMOKE_FACTOR,
} from "./smoke";
import { resolveRoom, useSession } from "./session";
import { useGame, watchedRoom, VIEWS, type ViewMode } from "./store";
import mascot from "../../ChatGPT Image Sep 6, 2026, 12_03_22 AM.png";
import PuzzleModal from "./PuzzleModal";
import TouchControls from "./components/TouchControls";
import { useCoarsePointer } from "./useCoarsePointer";

const GameCanvas = dynamic(() => import("./GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-xs tracking-widest text-zinc-500">
      LOADING FACILITY...
    </div>
  ),
});

const HIDDEN = MARKERS.filter((m) => m.reveal === "discovery");

/**
 * Is this sender the warden posted to the sector the evacuee is standing in?
 *
 * The sender gates itself too, but the evacuee is the one who has to act on a
 * callout, so the receiver checks as well: a message already in flight when the
 * evacuee crosses a door must not arrive as guidance about the sector they
 * just left.
 */
function onLiveChannel(by: string) {
  const session = useSession.getState();
  const sender = resolveRoom(session.room)?.players.find((p) => p.id === by);
  if (!sender || sender.role !== "spectator") return false;
  return channelOpen(useGame.getState().room, sender.watching);
}
const noSubscribe = () => () => {};
const readOnboardingCompletion = () => {
  try {
    return localStorage.getItem("campusevac:onboarding:v1") === "complete";
  } catch {
    return false;
  }
};

function Bar({
  label,
  value,
  color,
  danger,
}: {
  label: string;
  value: number;
  color: string;
  danger?: boolean;
}) {
  return (
    <div className="w-36">
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-zinc-400">
        <span>{label}</span>
        <span style={{ color: danger ? "#ff5a63" : color }}>
          {Math.round(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function DiscoveryPanel() {
  const discovered = useGame((s) => s.discovered);
  const mode = useGame((s) => s.mode);
  const explored = useGame((s) => s.explored);
  const currentRoom = useGame((s) => s.room);
  const mine =
    mode.kind === "spectator"
      ? HIDDEN.filter((m) => m.room === mode.watching)
      : HIDDEN;
  const room = watchedRoom(mode) ?? currentRoom;
  const roomDef = roomById(room);
  const found = mine.filter((m) => discovered[m.id]).length;
  const canSee = (room: string) =>
    mode.kind === "spectator"
      ? mode.watching === room
      : !!explored[room as keyof typeof explored];

  return (
    <div className="hud-panel w-[min(14rem,calc(100vw-1.5rem))] border-l-yellow-300 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-widest text-yellow-300/80">
          Room feed
        </span>
        <span className="font-mono text-xs text-yellow-300">
          {found}/{mine.length}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between text-[11px]">
        <span className="text-[#ffd23b]">Intel Points</span>
        <span className="font-mono font-bold text-[#ffd23b]">{useGame((s) => s.intelPoints)}</span>
      </div>
      <div className="mt-2 border-y border-white/10 py-2">
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-200">{roomDef.name}</div>
        <div className="mt-1 text-[10px] leading-snug text-zinc-500">{roomDef.blurb}</div>
      </div>
      <ul className="mt-2 space-y-1">
        {mine.map((m) => {
          const got = !!discovered[m.id];
          const open = canSee(m.room);
          return (
            <li
              key={m.id}
              className="flex items-center gap-2 text-[11px]"
              style={{ color: got ? m.color : open ? "#8b94a1" : "#4b5563" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: got ? m.color : "#374151" }}
              />
              <span className="truncate">
                {got
                  ? m.label
                  : open
                    ? "unidentified"
                    : `sealed - ${roomById(m.room).name}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Log() {
  const log = useGame((s) => s.log);
  if (!log.length) return null;
  return (
    <div className="hud-panel w-[min(18rem,calc(100vw-1.5rem))] p-3">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        <span>Comms log</span><span>{log.length}/6</span>
      </div>
      <div className="space-y-2 text-right">
        {log.map((l, i) => (
          <div
            key={l.id}
            className="border-b border-white/5 pb-1.5 text-[11px] leading-snug last:border-0 last:pb-0"
            style={{
              color:
                l.tone === "bad"
                  ? "#ff6b73"
                  : l.tone === "good"
                    ? "#5dffa8"
                    : "#9ca3af",
              opacity: 1 - i * 0.1,
            }}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmokeEvidenceCard() {
  const mode = useGame((s) => s.mode);
  const view = useGame((s) => s.view);
  const currentRoom = useGame((s) => s.room);
  const elapsed = useGame((s) => s.hazardElapsed);
  const ventilation = useGame((s) => s.alarmDisabled);
  const watched = mode.kind === "spectator" ? mode.watching : currentRoom;
  const visible = view !== "thief";
  if (!visible) return null;

  const intensity =
    getSectorSmoke(watched, elapsed) *
    (ventilation ? VENTILATION_SMOKE_FACTOR : 1);
  const band = smokeBand(intensity);
  const blocked =
    (watched === BLOCKED_ROUTE.from || watched === BLOCKED_ROUTE.to) &&
    isRouteBlocked(BLOCKED_ROUTE.from, BLOCKED_ROUTE.to, elapsed);
  const unsafe = blocked || intensity > SMOKE_EXPOSURE_THRESHOLD;
  const color = blocked ? "#ef4444" : unsafe ? "#f59e0b" : "#10b981";

  return (
    <div
      className="hud-panel w-[min(18rem,calc(100vw-1.5rem))] border-l-2 p-3"
      style={{ borderLeftColor: color }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">
          Smoke evidence
        </span>
        <span
          className="border px-1.5 py-0.5 font-mono text-[10px] font-black"
          style={{ borderColor: color, color }}
        >
          {band}
        </span>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-widest text-zinc-500">
        Sector: <span className="text-zinc-200">{roomById(watched).name}</span>
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
        <span className="text-zinc-500">Source</span>
        <span className="text-right text-zinc-200">{getSmokeSource(watched)}</span>
        <span className="text-zinc-500">Status</span>
        <span className="text-right font-black uppercase" style={{ color }}>
          {blocked ? "UNSAFE / BLOCKED" : unsafe ? "UNSAFE" : "SAFE"}
        </span>
        <span className="text-zinc-500">Timestamp</span>
        <span className="text-right font-mono text-zinc-300">
          T+{Math.floor(Math.max(0, elapsed))}s
        </span>
      </div>
      {ventilation && (
        <div className="mt-2 border-t border-white/10 pt-2 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
          Ventilation override active
        </div>
      )}
    </div>
  );
}

function DangerBanner() {
  const mode = useGame((s) => s.mode);
  const hp = useGame((s) => s.hp);
  const alarm = useGame((s) => s.alarm);
  const smokeIntensity = useGame((s) => s.smokeIntensity);
  const currentRoom = useGame((s) => s.room);
  const spotted = useGame((s) => s.spotted);
  const escaped = useGame((s) => s.escaped);
  const alarmDisabled = useGame((s) => s.alarmDisabled);
  const wardenView = mode.kind !== "thief";
  const smokeVisible =
    !wardenView ||
    mode.kind === "solo" ||
    (mode.kind === "spectator" && currentRoom === mode.watching);
  const previous = useRef<string | null>(null);

  const alert = escaped
    ? null
    : hp <= 0
      ? { label: "AIR CRITICAL", detail: "Drill ended — restart or return to the lobby", color: "#ff5b55" }
      : smokeVisible && smokeIntensity >= 0.65
        ? { label: "DENSE SMOKE", detail: "Air is getting thin — move toward clear air", color: "#ff5b55" }
        : smokeVisible && smokeIntensity > SMOKE_EXPOSURE_THRESHOLD
          ? { label: "SMOKE EXPOSURE", detail: "Move toward clear air before continuing", color: "#ffb347" }
          : wardenView && spotted
            ? { label: "HAZARD DETECTED", detail: "Evacuee exposed to the active hazard", color: "#ff5b55" }
            : wardenView && alarm > 65
              ? { label: "HAZARD RISING", detail: "Move to clear air before exposure is critical", color: "#ffb347" }
              : hp < 35
                ? { label: "AIR LOW", detail: "Find clear air before continuing deeper", color: "#ffb347" }
                : wardenView && alarmDisabled
                  ? { label: "VENTILATION ACTIVE", detail: "Smoke dispersal is reducing exposure", color: "#39ff88" }
                  : null;
  const alertLabel = alert?.label ?? null;

  useEffect(() => {
    if (alertLabel && previous.current !== alertLabel) playSignal("alert");
    previous.current = alertLabel;
  }, [alertLabel]);

  if (!alert) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-3 sm:top-5">
      <div
        className="flex max-w-[min(28rem,calc(100vw-1.5rem))] items-center gap-3 border-2 bg-black/90 px-4 py-2.5 shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
        style={{ borderColor: alert.color }}
        role="status"
        aria-live="polite"
      >
        <span className="signal-pulse h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: alert.color }} />
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.17em]" style={{ color: alert.color }}>{alert.label}</div>
          <div className="mt-0.5 text-[10px] text-zinc-300">{alert.detail}</div>
        </div>
      </div>
    </div>
  );
}

function CommandDeck() {
  const sendCommand = useSession((s) => s.sendCommand);
  const sendPowerUp = useSession((s) => s.sendPowerUp);
  const intelPoints = useGame((s) => s.intelPoints);
  const spendIntel = useGame((s) => s.spendIntel);
  const mode = useGame((s) => s.mode);
  const evacueeRoom = useGame((s) => s.room);
  const watching = watchedRoom(mode);
  const [sent, setSent] = useState<CommandCode | null>(null);
  const lastSent = useRef<{ code: CommandCode; at: number } | null>(null);

  // one warden talks at a time: the one whose sector the evacuee is standing in
  const holder = commandChannel(evacueeRoom);
  const live = channelOpen(evacueeRoom, watching);
  const offAir = holder
    ? `Evacuee is in ${roomById(holder).name} — that sector’s warden has the channel.`
    : `Evacuee is in ${roomById(evacueeRoom).name}. No warden has the channel until they reach a monitored sector.`;

  return (
    <div
      className="hud-panel w-full p-2 sm:w-[min(38rem,calc(100vw-1.5rem))]"
      style={{ borderLeftColor: live ? "#e9ff4f" : "#4b5563" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1.5">
        <div>
          <div
            className="text-[9px] font-black uppercase tracking-[0.18em]"
            style={{ color: live ? "#e9ff4f" : "#8b94a1" }}
          >
            {live ? "Commands / tap to transmit" : "Channel held by another room"}
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-600">
          <span
            className={live ? "signal-pulse h-1.5 w-1.5 rounded-full" : "h-1.5 w-1.5 rounded-full"}
            style={{ background: live ? "#e9ff4f" : "#4b5563" }}
          />
          {live ? "EVACUEE CHANNEL · LIVE" : "OFF AIR"}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1 overflow-x-auto sm:gap-1.5">
        {COMMANDS.map((command) => (
          <button
            key={command.code}
            disabled={!live}
            onClick={() => {
              const now = Date.now();
              if (lastSent.current?.code === command.code && now - lastSent.current.at < 350) return;
              lastSent.current = { code: command.code, at: now };
              sendCommand(command.code);
              playSignal("command");
              setSent(command.code);
              window.setTimeout(() => setSent((current) => (current === command.code ? null : current)), 900);
            }}
            className="min-w-0 flex-1 touch-manipulation border border-white/20 bg-white/[0.04] px-0.5 py-2.5 text-center transition enabled:hover:bg-white/10 enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-30 sm:min-w-[4.2rem] sm:px-1.5 sm:py-1.5"
            style={{ borderLeftColor: command.color, borderLeftWidth: 3 }}
          >
            <span className="block font-mono text-[10px] font-black" style={{ color: command.color }}>
              {sent === command.code ? "SENT" : command.code}
            </span>
            <span className="mt-0.5 hidden truncate text-[8px] font-bold text-zinc-200 sm:block">{command.label.replace("Move ", "").replace("Go ", "")}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 text-[8px] uppercase tracking-widest text-zinc-600">
        {live
          ? "Short verified callouts only. The evacuee is moving."
          : `${offAir} You are back on the moment they enter your sector.`}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-400">Support Actions</div>
        <div className="flex gap-2">
          <button
            disabled={intelPoints < 50}
            onClick={() => { spendIntel(50); sendPowerUp("heal"); playSignal("command"); }}
            className="border border-white/20 bg-white/5 px-2 py-1 text-[9px] font-black uppercase text-emerald-400 disabled:opacity-30 hover:bg-white/10"
          >
            Stabilise (50 IP)
          </button>
          <button
            disabled={intelPoints < 50}
            onClick={() => { spendIntel(50); sendPowerUp("invis"); playSignal("command"); }}
            className="border border-white/20 bg-white/5 px-2 py-1 text-[9px] font-black uppercase text-[#e9ff4f] disabled:opacity-30 hover:bg-white/10"
          >
            Safe passage (50 IP)
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandTransmission() {
  const mode = useGame((s) => s.mode);
  const lastCommand = useGame((s) => s.lastCommand);
  const [now, setNow] = useState(() => Date.now());
  const commandId = lastCommand?.id;

  useEffect(() => {
    if (commandId === undefined) return;
    playSignal("command");
    const tick = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(tick);
  }, [commandId]);

  if (mode.kind !== "thief" || !lastCommand || now - lastCommand.at > 6500) return null;
  const command = commandByCode(lastCommand.code);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-3 sm:top-24">
      <div className="flex max-w-[min(31rem,calc(100vw-1.5rem))] items-center gap-3 border-2 border-[#e9ff4f] bg-[#111216]/95 px-4 py-3 shadow-[5px_5px_0_#e9ff4f]">
        <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-[#e9ff4f] font-mono text-[9px] font-black text-[#e9ff4f]">RX</span>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e9ff4f]">Warden transmission / {lastCommand.code}</div>
          <div className="mt-1 text-sm font-black uppercase text-zinc-100">{command.label}</div>
          <div className="mt-0.5 text-[10px] text-zinc-400">{command.detail} — route guidance from warden</div>
        </div>
      </div>
    </div>
  );
}

function EndCard({ onReset }: { onReset?: () => void }) {
  const escaped = useGame((s) => s.escaped);
  const via = useGame((s) => s.escapedVia);
  const hp = useGame((s) => s.hp);
  const score = useGame((s) => s.score);
  const gotLoot = useGame((s) => !!s.collected["vault-loot"]);
  const solo = useGame((s) => s.mode.kind === "solo");
  const reset = useGame((s) => s.reset);
  if (!escaped && hp > 0) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-[min(24rem,calc(100vw-2rem))] border-2 bg-[#0b0e13] px-6 py-6 text-center shadow-[6px_6px_0_rgba(0,0,0,0.6)]"
        style={{ borderColor: escaped ? "#5dffa8" : "#ff6b73" }}
      >
        <div
          className="text-3xl font-black uppercase tracking-[-0.03em]"
          style={{ color: escaped ? "#5dffa8" : "#ff6b73" }}
        >
           {escaped ? "Assembly Reached" : "Air Critical"}
        </div>
        {escaped && (
          <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            {via === "vent" ? "Via the marked service exit" : "Via the main entrance"}
            {gotLoot ? " · supplies secured" : " · supplies not recovered"}
          </div>
        )}
        <div className="mt-3 font-mono text-sm text-zinc-300">Score {score}</div>
        {solo && (
          <button
            onClick={() => {
              reset();
              onReset?.();
            }}
            className="mt-5 w-full border-2 border-white/25 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-100 hover:bg-white/10"
          >
            Run drill again
          </button>
        )}
      </div>
    </div>
  );
}

const ONBOARDING_KEY = "campusevac:onboarding:v1";
const INTRO_AUDIO_URL = "/api/voice?kind=intro";

function Onboarding() {
  const mode = useGame((s) => s.mode);
  const completed = useSyncExternalStore(
    noSubscribe,
    readOnboardingCompletion,
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const open = !completed && !dismissed;

  useEffect(() => {
    if (open) playNarrationOnce("campusevac-intro", INTRO_AUDIO_URL);
  }, [open]);

  if (!open) return null;

  const finish = () => {
    playNarrationOnce("campusevac-intro", INTRO_AUDIO_URL);
    try {
      localStorage.setItem(ONBOARDING_KEY, "complete");
    } catch {
      /* private browsing can still dismiss the guide for this session */
    }
    setDismissed(true);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-xl border-2 border-[#e9ff4f] bg-[#111216] p-5 text-zinc-100 shadow-[7px_7px_0_#e9ff4f] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/20 pb-4">
          <div className="flex items-center gap-3">
            <Image
              src={mascot}
               alt="CampusEvac field kit illustration"
              width={84}
              height={84}
              priority
              className="h-16 w-16 object-contain"
            />
            <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e9ff4f]">
              CampusEvac · First Briefing
            </div>
            <h2 id="onboarding-title" className="mt-2 text-2xl font-black uppercase tracking-[-0.04em]">
              {mode.kind === "spectator" ? "Guide the evacuee to safety" : "Reach the assembly point"}
            </h2>
            </div>
          </div>
          <button
            onClick={finish}
            className="border border-white/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:bg-white/10"
          >
            Skip
          </button>
        </div>

        <div className="mt-5 grid gap-4 text-sm leading-relaxed text-zinc-300 sm:grid-cols-2">
          <div className="border-l-2 border-[#3b63ff] pl-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#4aa8ff]">Objective</h3>
            <p className="mt-2">Cross the affected sector, follow verified route guidance, and reach the assembly point.</p>
          </div>
          <div className="border-l-2 border-[#39ff88] pl-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#39ff88]">Core mechanic</h3>
            <p className="mt-2">The evacuee cannot see the hazard layer. Wardens inspect one sector each and relay short, verified route guidance.</p>
          </div>
          <div className="border-l-2 border-[#ffd23b] pl-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#ffd23b]">Controls</h3>
            <p className="mt-2">
              {mode.kind === "spectator"
                ? "Your room is drawn from one fixed angle so directions always match. Scroll to zoom, and use Watch / Discover to inspect it."
                : "WASD moves, Shift runs, Space jumps, E interacts, and click captures the mouse for looking around."}
            </p>
          </div>
          <div className="border-l-2 border-[#ff6b73] pl-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#ff6b73]">Survive / win</h3>
            <p className="mt-2">Manage air exposure, verify the route, use emergency controls, and reach assembly safely.</p>
          </div>
        </div>

        <button onClick={finish} className="brutal-button mt-6 w-full px-4 py-3">
           Understood — enter the drill
        </button>
      </section>
    </div>
  );
}

export default function GameShell({ title }: { title?: string }) {
  const mode = useGame((s) => s.mode);
  const view = useGame((s) => s.view);
  const setView = useGame((s) => s.setView);
  const hp = useGame((s) => s.hp);
  const alarm = useGame((s) => s.alarm);
  const spotted = useGame((s) => s.spotted);
  const loot = useGame((s) => s.loot);
  const score = useGame((s) => s.score);
  const prompt = useGame((s) => s.prompt);
  const codeFound = useGame((s) => s.codeFound);
  const keycard = useGame((s) => s.keycard);
  const alarmDisabled = useGame((s) => s.alarmDisabled);
  const room = useGame((s) => s.room);
  const explored = useGame((s) => s.explored);
  const gotLoot = useGame((s) => !!s.collected["vault-loot"]);
  const ventFound = useGame(
    (s) => s.ventOpen || !!s.discovered["vault-vent"],
  );
  const reset = useGame((s) => s.reset);
  const leave = useSession((s) => s.leave);
  const onCommand = useSession((s) => s.onCommand);
  const onVoice = useSession((s) => s.onVoice);
  const onPowerUp = useSession((s) => s.onPowerUp);
  const router = useRouter();

  const [activePuzzle, setActivePuzzle] = useState<{ id: string; label: string; roomName: string } | null>(null);

  useEffect(() => {
    const handleStartPuzzle = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActivePuzzle(customEvent.detail);
    };
    window.addEventListener("start-puzzle", handleStartPuzzle);
    return () => window.removeEventListener("start-puzzle", handleStartPuzzle);
  }, []);

  const solo = mode.kind === "solo";
  const spectator = mode.kind === "spectator";
  const touch = useCoarsePointer();
  // The evacuee drives the world, so they need the touch stick.
  const showStick = touch && view === "thief";
  const v = VIEWS.find((x) => x.id === view)!;

  useEffect(() => {
    if (!solo) return;
    const onKey = (e: KeyboardEvent) => {
      const i = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
      if (i >= 0) setView(VIEWS[i].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, solo]);

  useEffect(() => {
    if (mode.kind !== "thief") return;
    return onCommand((code, by) => {
      if (!onLiveChannel(by)) return;
      useGame.getState().receiveCommand(code, by);
    });
  }, [mode.kind, onCommand]);

  useEffect(() => {
    if (mode.kind !== "thief") return;
    return onPowerUp((effect, by) => useGame.getState().applyPowerUp(effect, by));
  }, [mode.kind, onPowerUp]);

  useEffect(() => {
    if (mode.kind !== "thief") {
      clearVoiceQueue();
      return;
    }
    const valid = () => {
      const session = useSession.getState();
      const player = session.room?.players.find((candidate) => candidate.id === session.myId);
      return session.room?.phase === "playing" && player?.role === "thief";
    };
    const unsubscribe = onVoice((voice) => {
      if (!valid() || !onLiveChannel(voice.by)) return;
      // re-check on playback too: a clip queued behind another must not still
      // be talking about the last room by the time it is its turn
      enqueueVoice(voice.id, voice.audioUrl, () => valid() && onLiveChannel(voice.by));
    });
    return () => {
      unsubscribe();
      clearVoiceQueue();
    };
  }, [mode.kind, onVoice]);

  // Next-action prompt, explicit during the CampusEvac migration.
  const objective = ventFound
    ? gotLoot
      ? "Proceed through the service exit (Space) to the assembly point."
      : "Service exit is open. Secure supplies or proceed to assembly (Space)."
    : keycard
      ? "Bring the access key to the emergency panel at the north exit (E)."
      : explored.lobby
        ? "Locate the emergency access key in the control sector."
        : "Enter through the main campus entrance.";

  return (
    <div className="game-surface absolute inset-0 overflow-hidden bg-[#06080c] text-zinc-100">
      <GameCanvas />
      <DangerBanner />
      <CommandTransmission />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="pointer-events-auto flex min-w-0 max-w-[36vw] flex-col gap-3 sm:max-w-[min(32rem,calc(100vw-1.5rem))]">
          <div>
            <h1 className="text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-zinc-200 sm:text-sm sm:tracking-[0.2em]">
              {title ?? "CampusEvac Drill"}
            </h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block">
              {spectator
                ? `Assigned to ${roomById(mode.watching).name}. You see what the evacuee cannot — guide them.`
                : mode.kind === "thief"
                  ? "You are the evacuee. You cannot see the hazard layer — your wardens can."
                  : "Solo sandbox — drive the evacuee and inspect all three layers."}
            </p>
          </div>
          {!spectator && (
            <div className="hud-panel hidden px-3 py-2 sm:block" style={{ borderColor: `${v.color}66` }}>
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: v.color }}>{`${v.n}. ${v.title}`}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-zinc-400">{v.blurb}</div>
            </div>
          )}
        </div>

      <div className="pointer-events-auto flex max-w-[62vw] flex-col items-end gap-2 sm:max-w-none">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {solo && (
              <select
                value={view}
                onChange={(e) => setView(e.target.value as ViewMode)}
                className="w-[7.5rem] border-2 border-white/30 bg-zinc-950/90 px-2 py-2 text-[11px] text-zinc-100 outline-none focus:border-yellow-300 sm:w-auto sm:px-3 sm:text-xs"
              >
                {VIEWS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.n}. {x.title}
                  </option>
                ))}
              </select>
            )}
            {spectator && (
              <div className="flex overflow-hidden border-2 border-white/30">
                {(["spectator", "discovery"] as ViewMode[]).map((id) => (
                  <button
                    key={id}
                    onClick={() => setView(id)}
                    className={`px-3 py-2 text-[11px] uppercase tracking-widest ${
                      view === id
                        ? "bg-[#e9ff4f] text-[#111216]"
                        : "bg-zinc-950/90 text-zinc-400 hover:bg-white/10"
                    }`}
                  >
                    {id === "spectator" ? "Watch" : "Discover"}
                  </button>
                ))}
              </div>
            )}
            {solo && (
              <button
                onClick={reset}
                className="border-2 border-white/30 bg-zinc-950/90 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-white/10"
              >
                Reset
              </button>
            )}
            {!solo && (
              <button
                onClick={() => {
                  leave();
                  router.push("/rooms");
                }}
                className="border-2 border-white/30 bg-zinc-950/90 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-white/10"
              >
                Leave room
              </button>
            )}
          </div>
          <Minimap />
        </div>
      </div>

      <div className="pointer-events-none absolute right-2 top-[11rem] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:right-4 sm:top-[15.5rem]">
        <SmokeEvidenceCard />
        {view === "discovery" && (
          <div className="pointer-events-auto">
            <DiscoveryPanel />
          </div>
        )}
        {!spectator && <Log />}
      </div>

      {spectator && (
        <div className="pointer-events-auto absolute inset-x-2 bottom-3 z-10 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2">
          <CommandDeck />
        </div>
      )}

      {/* bottom bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 flex items-end justify-between gap-3 p-3 sm:gap-4 sm:p-4 ${
          // clear whichever set of controls is on screen rather than sit under
          // them: the evacuee's thumbs, or the warden's command deck
          showStick
            ? "bottom-[178px] sm:bottom-0"
            : spectator
              ? "bottom-[9rem] sm:bottom-0"
              : "bottom-0"
        }`}
      >
        <div className="hud-panel flex max-w-[min(22rem,60vw)] flex-col gap-2 p-2 text-[10px] sm:max-w-full sm:gap-3 sm:p-3 sm:text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-white/25 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-zinc-300">
              {roomById(room).name}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">{roomById(room).blurb}</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-200">{objective}</div>
            <div className="flex flex-wrap gap-4 sm:gap-5">
            <Bar label="AIR" value={hp} color="#5dffa8" danger={hp < 35} />
            {mode.kind !== "thief" && (
              <Bar
                label={
                  alarmDisabled
                    ? "Hazard — offline"
                    : spotted
                      ? "Hazard — exposed!"
                      : "Hazard"
                }
                value={alarmDisabled ? 0 : alarm}
                color="#ff6b73"
                danger={alarm > 60}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[11px] text-zinc-400">
            <span className={keycard ? "text-yellow-300" : ""}>
              keycard {keycard ? "yes" : "no"}
            </span>
            <span className={codeFound ? "text-emerald-400" : ""}>
              code {codeFound ? "4712" : "????"}
            </span>
            <span>supplies {loot}</span>
            <span>score {score}</span>
          </div>
        </div>

        <div className="hud-panel hidden p-3 text-right text-[11px] leading-relaxed text-zinc-400 sm:block">
          {spectator ? (
            <>
              <div>fixed view · scroll to zoom</div>
              <div>
                <span className="text-zinc-200">Watch / Discover</span> switches
                layer
              </div>
              <div>your sector never rotates — left is the evacuee’s left</div>
            </>
          ) : (
            <>
              <div>
                <span className="text-zinc-200">WASD</span> move ·{" "}
                <span className="text-zinc-200">Shift</span> run ·{" "}
                <span className="text-zinc-200">Space</span> jump ·{" "}
                <span className="text-zinc-200">E</span> interact
              </div>
              <div>
                {view === "thief"
                  ? "click to capture the mouse · Esc releases"
                  : "drag to orbit · scroll to zoom"}
              </div>
              {mode.kind === "thief" && (
                <div className="border-t border-white/10 pt-1 text-[#e9ff4f]">warden guidance: LEFT · RIGHT · RUN · HIDE · STOP</div>
              )}
              {solo && (
                <div>
                  <span className="text-zinc-200">1 / 2 / 3</span> switch view
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {prompt && !spectator && !showStick && (
        <div className="pointer-events-none absolute inset-x-0 bottom-36 flex justify-center px-3 sm:bottom-32">
          <div className="border border-yellow-400/50 bg-black/90 px-3 py-1.5 text-center text-[11px] text-yellow-200 shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
            {prompt}
          </div>
        </div>
      )}

      {view === "thief" && !showStick && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 border border-white/45">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#e9ff4f]" />
        </div>
      )}

      {activePuzzle && (
        <PuzzleModal
          itemId={activePuzzle.id}
          itemLabel={activePuzzle.label}
          roomName={activePuzzle.roomName}
          onSuccess={() => {
            useGame.getState().discover(activePuzzle.id, activePuzzle.label);
            if (spectator) useSession.getState().sendDiscover(activePuzzle.id);
            setActivePuzzle(null);
          }}
          // a cancelled or timed-out scan leaves the blip where it was, so
          // nothing on the critical path can be lost to a mistap
          onCancel={() => setActivePuzzle(null)}
        />
      )}

      {showStick && <TouchControls />}

      <Onboarding />
      <EndCard />
    </div>
  );
}
