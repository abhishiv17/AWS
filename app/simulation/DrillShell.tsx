"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Minimap from "./components/Minimap";
import TouchControls from "./components/TouchControls";
import { useCoarsePointer } from "./useCoarsePointer";
import { COMMANDS, commandByCode, type CommandCode } from "./commands";
import { roomById } from "./level";
import { playSignal } from "./audio";
import BriefingArtwork from "./components/BriefingArtwork";
import { EVACUEE_BRIEFING, loadBedrockBriefing, speakNarration, stopNarration } from "./narration";
import { runtime } from "./runtime";
import { useSession } from "./session";
import {
  useSimulation,
  watchedSector,
  VIEWS,
  type ViewMode,
  nextScenarioObjective,
} from "./store";
import type { EvidenceStatus, RouteMessage } from "./net/types";

const DrillCanvas = dynamic(() => import("./DrillCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-xs tracking-widest text-zinc-500">
      LOADING CAMPUS BLOCK...
    </div>
  ),
});

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
        <span style={{ color: danger ? "#ef4444" : color }}>{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function statusColor(status: EvidenceStatus) {
  return status === "VERIFIED"
    ? "#10b981"
    : status === "OBSERVED"
      ? "#facc15"
      : status === "STALE" || status === "EXPIRED"
        ? "#f59e0b"
        : "#38bdf8";
}

function EvidencePanel() {
  const mode = useSimulation((state) => state.mode);
  const view = useSimulation((state) => state.view);
  const evidenceMap = useSimulation((state) => state.evidence);
  const observeEvidence = useSession((state) => state.observeEvidence);
  const sendCommand = useSession((state) => state.sendCommand);
  const evidence = Object.values(evidenceMap);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (view === "evacuee" || (mode.kind !== "warden" && evidence.length === 0)) return null;

  return (
    <div className="hud-panel w-[min(22rem,calc(100vw-1.5rem))] border-l-2 border-l-[#facc15] p-3">
      <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#facc15]">Evidence station</span>
        <span className="font-mono text-[10px] text-zinc-500">{evidence.length} targets</span>
      </div>
      {evidence.length === 0 ? (
        <p className="mt-3 text-[11px] text-zinc-500">Waiting for the assigned sector feed.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {evidence.map((item) => {
            const color = statusColor(item.status);
            const age = item.observedAt ? `${Math.max(0, Math.floor((now - item.observedAt) / 1000))}s ago` : "not observed";
            return (
              <li key={item.id} className="border-b border-white/10 pb-2 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-zinc-200">{item.label}</div>
                    <div className="mt-0.5 text-[9px] text-zinc-500">{item.source} · {age}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] font-black" style={{ color }}>{item.status}</span>
                </div>
                <div className="mt-1 text-[10px] leading-snug text-zinc-400">{item.nextAction}</div>
                <div className="mt-2 flex gap-2">
                  {item.status === "UNKNOWN" && (
                    <button onClick={() => observeEvidence(item.id)} className="border border-[#facc15]/60 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#facc15] hover:bg-[#facc15]/10">
                      Observe
                    </button>
                  )}
                  {item.status === "OBSERVED" && (
                    <button onClick={() => sendCommand("VERIFY_EAST_ROUTE", item.id)} className="border border-[#10b981]/60 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#10b981] hover:bg-[#10b981]/10">
                      Verify
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Log() {
  const log = useSimulation((state) => state.log);
  if (!log.length) return null;
  return (
    <div className="hud-panel w-[min(20rem,calc(100vw-1.5rem))] p-3">
      <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">
        <span>Drill log</span><span>{log.length}/6</span>
      </div>
      <div className="space-y-2 text-right">
        {log.map((entry, index) => (
          <div key={entry.id} className="border-b border-white/5 pb-1.5 text-[11px] leading-snug last:border-0 last:pb-0" style={{ color: entry.tone === "bad" ? "#ef4444" : entry.tone === "good" ? "#10b981" : "#9ca3af", opacity: 1 - index * 0.1 }}>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionBadge() {
  const status = useSession((state) => state.status);
  const label = status === "connected" ? "CONNECTED" : status === "connecting" ? "CONNECTING" : status === "idle" ? "LOCAL" : status.toUpperCase();
  const color = status === "connected" ? "#10b981" : status === "idle" ? "#38bdf8" : "#facc15";
  return <span className="flex items-center gap-1.5 font-mono text-[9px]" style={{ color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function RouteMessageCard() {
  const mode = useSimulation((state) => state.mode);
  const message = useSimulation((state) => state.latestMessage);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (mode.kind !== "evacuee" || !message || message.expiresAt <= now) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-3 sm:top-24">
      <div className="max-w-[min(34rem,calc(100vw-1.5rem))] border-2 border-[#10b981] bg-[#111216]/95 px-4 py-3 shadow-[5px_5px_0_#10b981]" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border-2 border-[#10b981] font-mono text-[9px] font-black text-[#10b981]">RX</span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#10b981]">Warden message / {message.confidence}</div>
            <div className="mt-1 text-sm font-black uppercase text-zinc-100">{message.caption}</div>
            <div className="mt-0.5 text-[10px] text-zinc-400">Expires in {Math.ceil((message.expiresAt - now) / 1000)}s · you choose the route</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HazardBanner() {
  const mode = useSimulation((state) => state.mode);
  const air = useSimulation((state) => state.air);
  const smoke = useSimulation((state) => state.smokeIntensity);
  const routeStatus = useSimulation((state) => state.routeStatus);
  const failed = useSimulation((state) => state.failed);
  const complete = useSimulation((state) => state.assemblyConfirmed);
  const previous = useRef<string | null>(null);
  const warden = mode.kind === "warden";
  const alert = complete
    ? null
    : failed
      ? { label: "TRAINING OUTCOME RECORDED", detail: "Review the decision timeline and replay.", color: "#ef4444" }
      : air <= 30
        ? { label: "AIR GETTING THIN", detail: "Move toward clear air.", color: "#ef4444" }
        : routeStatus === "unsafe" && warden
          ? { label: "EAST ROUTE BLOCKED", detail: "Verify the evidence and send the west route.", color: "#ef4444" }
          : smoke > 0.2 && !warden
            ? { label: "SMOKE EXPOSURE", detail: "Move toward clear air and watch your route message.", color: "#f59e0b" }
            : null;
  const alertLabel = alert?.label ?? null;
  useEffect(() => {
    if (alertLabel && previous.current !== alertLabel) playSignal("alert");
    previous.current = alertLabel;
  }, [alertLabel]);
  if (!alert) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-3 sm:top-5">
      <div className="flex max-w-[min(30rem,calc(100vw-1.5rem))] items-center gap-3 border-2 bg-black/90 px-4 py-2.5" style={{ borderColor: alert.color }} role="status" aria-live="polite">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: alert.color }} />
        <div><div className="text-[11px] font-black uppercase tracking-[0.17em]" style={{ color: alert.color }}>{alert.label}</div><div className="mt-0.5 text-[10px] text-zinc-300">{alert.detail}</div></div>
      </div>
    </div>
  );
}

function CommandDeck() {
  const mode = useSimulation((state) => state.mode);
  const evidence = useSimulation((state) => state.evidence["east-route-evidence"]);
  const interventionApplied = useSimulation((state) => state.interventionApplied);
  const scenarioProgress = useSimulation((state) => state.scenarioProgress);
  const lastAcknowledgement = useSimulation((state) => state.lastAcknowledgement);
  const sendCommand = useSession((state) => state.sendCommand);
  const [sent, setSent] = useState<CommandCode | null>(null);
  if (mode.kind !== "warden") return null;
  return (
    <div className="hud-panel w-full p-2 sm:w-[min(42rem,calc(100vw-1.5rem))]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1.5">
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#facc15]">Warden command deck</div>
        <span className="font-mono text-[9px] text-zinc-500">sector / {mode.sectorId}</span>
      </div>
      <div className="mt-1.5 flex gap-1 overflow-x-auto sm:gap-1.5">
        {COMMANDS.map((command) => {
          const disabled = command.code === "VERIFY_EAST_ROUTE"
            ? evidence?.status !== "OBSERVED"
            : command.code === "SEND_WEST_ROUTE" || command.code === "MARK_EAST_UNSAFE"
              ? evidence?.status !== "VERIFIED"
              : interventionApplied || evidence?.status !== "VERIFIED";
          return (
            <button
              key={command.code}
              disabled={disabled}
              onClick={() => {
                sendCommand(command.code, command.code === "APPLY_VENTILATION" ? undefined : "east-route-evidence");
                setSent(command.code);
                playSignal("command");
                window.setTimeout(() => setSent((current) => current === command.code ? null : current), 900);
              }}
              className="min-w-0 flex-1 border border-white/20 bg-white/[0.04] px-1 py-2.5 text-center transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 sm:min-w-[6.5rem] sm:py-2"
              style={{ borderLeftColor: command.color, borderLeftWidth: 3 }}
            >
              <span className="block font-mono text-[9px] font-black" style={{ color: command.color }}>{sent === command.code ? "SENT" : command.label}</span>
              <span className="mt-0.5 hidden truncate text-[8px] text-zinc-400 sm:block">{command.detail}</span>
            </button>
          );
        })}
      </div>
       <div className="mt-1 flex justify-between gap-3 text-[8px] uppercase tracking-widest text-zinc-600"><span>Verify first. Every accepted action is acknowledged.</span><span>{Object.values(scenarioProgress).filter(Boolean).length}/7 evacuee steps</span></div>
      {lastAcknowledgement && <div className="mt-2 border-t border-white/10 pt-2 text-[10px]" style={{ color: lastAcknowledgement.accepted ? "#10b981" : "#ef4444" }}>{lastAcknowledgement.accepted ? "Accepted" : "Denied"}: {commandByCode(lastAcknowledgement.command).label}{lastAcknowledgement.reason ? ` - ${lastAcknowledgement.reason}` : ""}</div>}
    </div>
  );
}

function EndCard({ onReset, onLeave }: { onReset: () => void; onLeave: () => void }) {
  const complete = useSimulation((state) => state.assemblyConfirmed);
  const failed = useSimulation((state) => state.failed);
  const solo = useSimulation((state) => state.mode.kind === "solo");
  const routeStatus = useSimulation((state) => state.routeStatus);
  const interventionApplied = useSimulation((state) => state.interventionApplied);
  const latestMessage = useSimulation((state) => state.latestMessage);
  const reset = useSimulation((state) => state.reset);
  if (!complete && !failed) return null;
  const safeOutcome = complete && !failed;
  const coordinationFailure = failed
    ? "The evacuee did not reach assembly before the drill failed."
    : latestMessage
      ? "The route message was delivered; review whether the handoff was early enough."
      : "The drill completed without a recorded route handoff.";
  const nextPractice = interventionApplied
    ? "Replay after verifying the route before applying the intervention."
    : routeStatus === "unsafe"
      ? "Replay with an earlier alternate-route decision."
      : "Replay after verifying the route evidence before messaging.";
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-[min(26rem,calc(100vw-2rem))] border-2 bg-[#0b0e13] px-6 py-6 text-center" style={{ borderColor: complete ? "#10b981" : "#ef4444" }}>
        <div className="text-3xl font-black uppercase tracking-[-0.03em]" style={{ color: complete ? "#10b981" : "#ef4444" }}>{complete ? "Assembly confirmed" : "Training outcome recorded"}</div>
        <div className="mt-5 grid gap-3 text-left text-[11px] leading-relaxed">
          <div className="border-l-2 border-[#10b981] pl-3"><div className="font-black uppercase tracking-widest text-[#10b981]">Did we evacuate safely?</div><div className="mt-1 text-zinc-300">{safeOutcome ? "Yes. The evacuee reached the authored assembly point." : "No. The drill ended before safe assembly confirmation."}</div></div>
          <div className="border-l-2 border-[#facc15] pl-3"><div className="font-black uppercase tracking-widest text-[#facc15]">Where did coordination fail?</div><div className="mt-1 text-zinc-300">{coordinationFailure}</div></div>
          <div className="border-l-2 border-[#38bdf8] pl-3"><div className="font-black uppercase tracking-widest text-[#38bdf8]">What should we practice next?</div><div className="mt-1 text-zinc-300">{nextPractice}</div></div>
        </div>
        {solo ? <button onClick={() => { reset(); onReset(); }} className="mt-5 w-full border-2 border-white/25 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-100 hover:bg-white/10">Run drill again</button> : <button onClick={onLeave} className="mt-5 w-full border-2 border-white/25 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-100 hover:bg-white/10">Return to drills</button>}
      </div>
    </div>
  );
}

const noExternalStoreSubscribe = () => () => {};

function readOnboardingOpen() {
  try { return localStorage.getItem("campusevac:onboarding:v2") !== "complete"; } catch { return true; }
}

function Onboarding() {
  const mode = useSimulation((state) => state.mode);
  const storedOpen = useSyncExternalStore(noExternalStoreSubscribe, readOnboardingOpen, () => false);
  const [dismissed, setDismissed] = useState(false);
  const open = storedOpen && !dismissed;
  if (!open) return null;
  const finish = () => {
    try { localStorage.setItem("campusevac:onboarding:v2", "complete"); } catch { /* session-only dismissal */ }
    window.dispatchEvent(new Event("start-briefing"));
    setDismissed(true);
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="w-full max-w-xl border-2 border-[#facc15] bg-[#111216] p-5 text-zinc-100 shadow-[7px_7px_0_#facc15] sm:p-7">
         <div className="border-b border-white/20 pb-4"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#facc15]">CampusEvac / mission brief</div><h2 id="onboarding-title" className="mt-2 text-2xl font-black uppercase tracking-[-0.04em]">{mode.kind === "warden" ? "Verify. Communicate. Adapt." : "Listen before you move."}</h2><p className="mt-2 max-w-lg text-xs leading-relaxed text-zinc-400">{mode.kind === "warden" ? "Your station opens immediately. The evacuee receives a separate guided briefing and does not see your hazard layer." : "A narrated four-step briefing explains the campus, controls, objectives, and information boundary. Movement stays locked until the last line finishes."}</p></div>
         <div className="mt-5 grid gap-3 text-xs leading-relaxed text-zinc-300 sm:grid-cols-2">
           <div className="border-l-2 border-[#38bdf8] pl-3"><h3 className="text-[10px] font-black uppercase tracking-widest text-[#38bdf8]">Route</h3><p className="mt-1">Entrance &rarr; Science Block &rarr; Academic Block &rarr; green exit.</p></div>
           <div className="border-l-2 border-[#ef4444] pl-3"><h3 className="text-[10px] font-black uppercase tracking-widest text-[#ef4444]">Hazard</h3><p className="mt-1">Read physical signs. The warden sees threats you do not.</p></div>
           <div className="border-l-2 border-[#facc15] pl-3"><h3 className="text-[10px] font-black uppercase tracking-widest text-[#facc15]">Controls</h3><p className="mt-1">WASD move, Shift sprint, Space jump, E interact, V camera.</p></div>
           <div className="border-l-2 border-[#10b981] pl-3"><h3 className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">Promise</h3><p className="mt-1">Captions stay on screen while the audio plays. No movement starts early.</p></div>
         </div>
         <button onClick={finish} className="brutal-button mt-6 w-full px-4 py-3">{mode.kind === "warden" ? "Open warden station" : "Start guided briefing"}</button>
      </section>
    </div>
  );
}

function Briefing() {
  const mode = useSimulation((state) => state.mode);
  const beginBriefing = useSimulation((state) => state.beginBriefing);
  const completeBriefing = useSimulation((state) => state.completeBriefing);
  const [line, setLine] = useState("");
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [lines, setLines] = useState(EVACUEE_BRIEFING);
  const step = useRef(0);

  useEffect(() => {
    if (mode.kind === "warden") return;
    let disposed = false;
    const start = () => {
      if (useSimulation.getState().briefingStatus === "playing") return;
      beginBriefing();
      setOpen(true);
      setSlide(0);
      setLine("Preparing your guided route briefing...");
      void loadBedrockBriefing().then((briefing) => {
        if (disposed) return;
        setLines(briefing);
        step.current = 0;
        const speakNext = () => {
          const next = briefing[step.current];
          if (!next) {
            setLine("Briefing complete. Your route is live.");
            window.setTimeout(() => {
              if (disposed) return;
              completeBriefing();
              setOpen(false);
            }, 900);
            return;
          }
          setSlide(step.current);
          setLine(next);
          step.current += 1;
          speakNarration(next, speakNext);
        };
        playSignal("command");
        speakNext();
      });
    };
    window.addEventListener("start-briefing", start);
    let autoStart: number | undefined;
    try {
      if (localStorage.getItem("campusevac:onboarding:v2") === "complete") autoStart = window.setTimeout(start, 700);
    } catch { /* transcript remains available from the mission brief */ }
    return () => {
      disposed = true;
      window.removeEventListener("start-briefing", start);
      if (autoStart) window.clearTimeout(autoStart);
      stopNarration();
    };
  }, [beginBriefing, completeBriefing, mode.kind]);

  if (mode.kind === "warden" || !open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-[#05070b]/85 p-4 backdrop-blur-md">
      <section className="w-full max-w-2xl border border-[#a78bfa]/70 bg-[#0b0e13] p-4 text-zinc-100 shadow-[8px_8px_0_rgba(167,139,250,.35)] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div><div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#a78bfa]">CampusEvac / guided briefing</div><h2 id="briefing-title" className="mt-1 text-xl font-black uppercase tracking-[-0.03em] sm:text-2xl">Listen. Understand. Then move.</h2></div>
          <div className="shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500"><div>{Math.min(slide + 1, lines.length)} / {lines.length}</div><div className="mt-1 text-[#a78bfa]">movement locked</div></div>
        </div>
        <div className="mt-4"><BriefingArtwork slide={slide} /></div>
        <div className="mt-4 border-l-2 border-[#a78bfa] bg-white/[0.03] px-4 py-3" aria-live="polite"><div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#a78bfa]">Narration / captions</div><div className="mt-1 text-sm leading-relaxed text-zinc-100 sm:text-base">{line}</div></div>
        <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[#a78bfa] transition-[width] duration-500" style={{ width: `${Math.min(100, ((slide + 1) / Math.max(1, lines.length)) * 100)}%` }} /></div><span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">audio + captions</span></div>
         <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-500">Keep this panel open. The controls activate automatically after the final line.</p>
       </section>
      </div>
   );
}

export default function DrillShell({ title }: { title?: string }) {
  const router = useRouter();
  const mode = useSimulation((state) => state.mode);
  const view = useSimulation((state) => state.view);
  const setView = useSimulation((state) => state.setView);
  const air = useSimulation((state) => state.air);
  const health = useSimulation((state) => state.health);
  const smoke = useSimulation((state) => state.smokeIntensity);
  const sector = useSimulation((state) => state.sector);
  const routeStatus = useSimulation((state) => state.routeStatus);
  const interventionApplied = useSimulation((state) => state.interventionApplied);
  const scenarioProgress = useSimulation((state) => state.scenarioProgress);
  const prompt = useSimulation((state) => state.prompt);
  const reset = useSimulation((state) => state.reset);
  const leave = useSession((state) => state.leave);
  const onRouteMessage = useSession((state) => state.onRouteMessage);
  const onAcknowledgement = useSession((state) => state.onAcknowledgement);
  const onWardenState = useSession((state) => state.onWardenState);
  const observeEvidence = useSession((state) => state.observeEvidence);
  const touch = useCoarsePointer();
  const solo = mode.kind === "solo";
  const warden = mode.kind === "warden";
  const showStick = touch && view === "evacuee";

  useEffect(() => {
    if (!solo) return;
    const onKey = (event: KeyboardEvent) => {
      const index = ["Digit1", "Digit2", "Digit3"].indexOf(event.code);
      if (index >= 0) setView(VIEWS[index].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, solo]);

  useEffect(() => {
    return onRouteMessage((message: RouteMessage) => useSimulation.getState().receiveRouteMessage(message));
  }, [onRouteMessage]);

  useEffect(() => {
    return onAcknowledgement((acknowledgement) => useSimulation.getState().receiveAcknowledgement(acknowledgement));
  }, [onAcknowledgement]);

  // Warden snapshots drive the HUD and the remote evacuee marker. They are applied
  // here, outside the canvas, so the station stays live before the 3D view mounts.
  useEffect(() => {
    if (!warden) return;
    return onWardenState((state) => {
      runtime.netEvacuee = state.evacuee
        ? {
            x: state.evacuee.position[0],
            y: state.evacuee.position[1],
            z: state.evacuee.position[2],
            yaw: state.evacuee.position[3],
            hasBackpack: state.hasBackpack,
            equipped: state.equipped,
            scenarioProgress: state.scenarioProgress,
          }
        : null;
      if (state.evacuee) {
        runtime.sector = state.evacuee.sectorId;
        runtime.evacueeYaw = state.evacuee.position[3];
      }
      runtime.alert = state.smokeIntensity * 100;
      useSimulation.getState().applyWardenState(state);
    });
  }, [onWardenState, warden]);

  useEffect(() => {
    const inspect = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id && warden) {
        observeEvidence(detail.id);
        playSignal("evidence");
      }
    };
    window.addEventListener("inspect-evidence", inspect);
    return () => window.removeEventListener("inspect-evidence", inspect);
  }, [observeEvidence, warden]);

  const watched = watchedSector(mode);
  const objective = warden
    ? interventionApplied
      ? "Intervention applied. Continue monitoring the alternate route."
      : "Verify the route evidence before communicating."
    : routeStatus === "unsafe"
      ? "East route is unsafe. Choose the west stair and reach assembly."
      : `Next: ${nextScenarioObjective(scenarioProgress)}.`;
  const roomName = roomById(sector).name;

  return (
    <div className="drill-surface absolute inset-0 overflow-hidden bg-[#06080c] text-zinc-100">
      <DrillCanvas />
      <Briefing />
      <HazardBanner />
      <RouteMessageCard />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="pointer-events-auto min-w-0 max-w-[58vw]">
          <h1 className="text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-zinc-200 sm:text-sm sm:tracking-[0.2em]">{title ?? "CampusEvac Drill"}</h1>
          <p className="mt-1 hidden text-[11px] text-zinc-500 sm:block">{warden ? `Warden station / assigned ${roomById(watched ?? "sec").name}` : mode.kind === "evacuee" ? "Evacuee view / limited hazard information" : "Solo practice / inspect the complete drill loop"}</p>
        </div>
        <div className="pointer-events-auto flex max-w-[62vw] flex-col items-end gap-2 sm:max-w-none">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ConnectionBadge />
            {solo && <select value={view} onChange={(event) => setView(event.target.value as ViewMode)} className="w-[8.5rem] border-2 border-white/30 bg-zinc-950/90 px-2 py-2 text-[11px] text-zinc-100 outline-none focus:border-[#facc15] sm:w-auto sm:px-3 sm:text-xs">{VIEWS.map((item) => <option key={item.id} value={item.id}>{item.n}. {item.title}</option>)}</select>}
            {warden && <div className="flex overflow-hidden border-2 border-white/30">{(["warden", "evidence"] as ViewMode[]).map((id) => <button key={id} onClick={() => setView(id)} className={`px-3 py-2 text-[11px] uppercase tracking-widest ${view === id ? "bg-[#facc15] text-[#111216]" : "bg-zinc-950/90 text-zinc-400 hover:bg-white/10"}`}>{id === "warden" ? "Watch" : "Evidence"}</button>)}</div>}
            {solo && <button onClick={() => { reset(); window.dispatchEvent(new Event("start-briefing")); }} className="border-2 border-white/30 bg-zinc-950/90 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-white/10">Reset</button>}
            {!solo && <button onClick={() => { leave(); router.push("/simulation/rooms"); }} className="border-2 border-white/30 bg-zinc-950/90 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-300 hover:bg-white/10">Leave drill</button>}
          </div>
            {view !== "evacuee" && <Minimap />}
        </div>
      </div>

      <div className="pointer-events-none absolute right-2 top-[11rem] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:right-4 sm:top-[15.5rem]">
        {view !== "evacuee" && <EvidencePanel />}
        {view !== "evacuee" && <Log />}
      </div>

      {warden && <div className="pointer-events-auto absolute inset-x-2 bottom-3 z-10 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2"><CommandDeck /></div>}

      <div className={`pointer-events-none absolute inset-x-0 flex items-end justify-between gap-3 p-3 sm:gap-4 sm:p-4 ${showStick ? "bottom-[178px] sm:bottom-0" : warden ? "bottom-[9rem] sm:bottom-0" : "bottom-0"}`}>
        <div className="hud-panel flex max-w-[min(25rem,70vw)] flex-col gap-2 p-2 text-[10px] sm:gap-3 sm:p-3 sm:text-xs">
          <div className="flex flex-wrap items-center gap-2"><span className="border border-white/25 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-zinc-300">{roomName}</span><span className="text-[10px] uppercase tracking-wide text-zinc-500">{roomById(sector).blurb}</span></div>
          <div className="mt-1 text-[11px] text-zinc-200">{objective}</div>
          <div className="flex flex-wrap gap-4 sm:gap-5"><Bar label="AIR" value={air} color="#10b981" danger={air < 35} /><Bar label="HEALTH" value={health} color="#fb7185" danger={health < 35} /></div>
          <div className="flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-wider text-zinc-400"><span style={{ color: routeStatus === "unsafe" ? "#ef4444" : routeStatus === "intervened" ? "#10b981" : "#facc15" }}>route / {routeStatus}</span>{warden && <span>smoke / {Math.round(smoke * 100)}%</span>}<span>sector / {sector}</span></div>
        </div>
        <div className="hud-panel hidden p-3 text-right text-[11px] leading-relaxed text-zinc-400 sm:block">{warden ? <><div>fixed sector view / zoom only</div><div><span className="text-zinc-200">Watch / Evidence</span> switches layer</div><div>verify before sending a route message</div></> : <><div><span className="text-zinc-200">WASD</span> move / <span className="text-zinc-200">Shift</span> sprint / <span className="text-zinc-200">Space</span> jump / <span className="text-zinc-200">E</span> interact / <span className="text-zinc-200">V</span> camera</div><div>{view === "evacuee" ? "click to capture the mouse / Esc releases" : "drag to orbit / scroll to zoom"}</div></>}</div>
      </div>

      {prompt && view === "evacuee" && !showStick && <div className="pointer-events-none absolute inset-x-0 bottom-36 flex justify-center px-3 sm:bottom-32"><div className="border border-[#facc15]/50 bg-black/90 px-3 py-1.5 text-center text-[11px] text-[#facc15]">{prompt}</div></div>}
      {view === "evacuee" && !showStick && <div className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 border border-white/45"><span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#facc15]" /></div>}
      {showStick && <TouchControls />}
      <Onboarding />
       <EndCard onReset={() => { setView("evacuee"); window.dispatchEvent(new Event("start-briefing")); }} onLeave={() => { leave(); router.push("/simulation/rooms"); }} />
    </div>
  );
}
