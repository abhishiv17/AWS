"use client";

import { nextScenarioGuidance, type RoomId, type ScenarioObjectId, type ScenarioProgress } from "./level";

/** Stable local briefing used when Bedrock is not configured or temporarily unavailable. One line per artwork slide. */
export const EVACUEE_BRIEFING = [
  "Welcome to CampusEvac. This is a fire drill. You are the evacuee, standing at the main entrance of the Science Block.",
  "You have six steps. Grab the backpack by the entrance. Then, in Chemistry Lab 1A, take the access card, close the gas valve, use the first-aid kit and read the safety note.",
  "Next, read the route guide in Classroom A201. When all six are done, return to the entrance and leave through the green exit doors.",
  "Your steps are listed top left and the map is top right. W A S D to move, E to interact, V to change camera, Escape to pause. Smoke builds over time, so keep moving.",
];

export type BriefingProvider = "bedrock" | "authored";
export type BriefingResult = { lines: string[]; provider: BriefingProvider };

/** Keep Bedrock available for a future provider handoff, but use local narration by default. */
export const useBedrock = false;

export async function loadBedrockBriefing(signal?: AbortSignal): Promise<BriefingResult> {
  const fallback: BriefingResult = { lines: EVACUEE_BRIEFING, provider: "authored" };
  if (!useBedrock) return fallback;
  try {
    const response = await fetch("/api/narration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "evacuee" }),
      signal,
    });
    if (!response.ok) return fallback;
    const body = (await response.json()) as { lines?: unknown; provider?: unknown };
    return Array.isArray(body.lines) && body.lines.every((line) => typeof line === "string") && body.lines.length > 0
      ? { lines: body.lines as string[], provider: body.provider === "bedrock" ? "bedrock" : "authored" }
      : fallback;
  } catch {
    return fallback;
  }
}

/** Said once, the first time the evacuee walks into a place. */
export const ROOM_NARRATION: Partial<Record<RoomId, string>> = {
  lobby: "Central corridor. The west door leads to Chemistry Lab 1A. The east door leads to Classroom A201.",
  wcorr: "Science Block passage. Chemistry Lab 1A is straight ahead.",
  sec: "Chemistry Lab 1A. The gas shut-off is in the back-left corner. The first-aid table is by the window.",
  ecorr: "Academic Block passage. Classroom A201 is straight ahead.",
  vault: "Classroom A201. The route guide is on the desk nearest the door.",
  annex: "Electrical service room. There is nothing you need in here. Head back out.",
};

const DONE: Record<ScenarioObjectId, string> = {
  "emergency-backpack": "Backpack secured.",
  "lab-access-card": "Access card collected.",
  "gas-valve": "Gas valve closed. The leak has stopped.",
  "first-aid-kit": "First-aid kit used. Health restored.",
  "lab-safety-clue": "Safety note read.",
  "academic-guide": "Route guide read.",
  "main-exit": "You made it out. Drill complete.",
};

/** What the narrator says when a step is completed, followed by the next instruction. */
export function objectiveNarration(id: ScenarioObjectId, progress: ScenarioProgress) {
  if (id === "main-exit") return DONE[id];
  const next = nextScenarioGuidance(progress);
  return next.id === "main-exit" ? `${DONE[id]} ${next.instruction}` : `${DONE[id]} Next: ${next.instruction}`;
}

const VOICE_KEY = "campusevac:voice";

/** Captions always show; this only controls whether they are also read aloud. */
export function readVoiceEnabled() {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeVoiceEnabled(enabled: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, enabled ? "on" : "off");
  } catch {
    /* preference lasts for this page only */
  }
  if (!enabled) stopNarration();
}

/** Prefer a clear, natural English voice where the browser offers one. */
function pickVoice() {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  return (
    voices.find((voice) => /natural|neural|aria|jenny|sonia|libby/i.test(voice.name)) ??
    voices.find((voice) => /google (uk|us) english|samantha|daniel/i.test(voice.name)) ??
    voices[0] ??
    null
  );
}

export function speakNarration(text: string, onEnd: () => void) {
  const estimatedMs = Math.max(2200, (text.split(/\s+/).length / 2.5) * 1000 + 1200);
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !readVoiceEnabled()) {
    globalThis.setTimeout(onEnd, estimatedMs);
    return;
  }
  window.speechSynthesis.cancel();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeout);
    onEnd();
  };
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.95;
  utterance.onend = finish;
  utterance.onerror = finish;
  const timeout = window.setTimeout(finish, estimatedMs + 4000);
  window.speechSynthesis.speak(utterance);
}

export function stopNarration() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
