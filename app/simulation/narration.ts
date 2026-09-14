"use client";

/** Stable local briefing used when Bedrock is not configured or temporarily unavailable. */
export const EVACUEE_BRIEFING = [
  "Welcome to CampusEvac. You are the evacuee, starting in the central entrance corridor. Stay calm and read the signs around you.",
  "Your route is simple: collect the emergency backpack, find the lab access card, read one clue in each block, and close the red gas valve.",
  "If your health drops, find the white first-aid kit and press E to use it. Then follow the marked safe route to the green exit.",
  "The warden can see hazards that you cannot. You will see physical clues and route messages. Do not move until this briefing is complete.",
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

export function speakNarration(text: string, onEnd: () => void) {
  const estimatedMs = Math.max(1800, (text.split(/\s+/).length / 2.35) * 1000 + 1800);
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
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
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 0.9;
  utterance.onend = finish;
  utterance.onerror = finish;
  const timeout = window.setTimeout(finish, estimatedMs);
  window.speechSynthesis.speak(utterance);
}

export function stopNarration() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
