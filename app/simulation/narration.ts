"use client";

/** Authored fallback briefing. A Bedrock voice can replace this provider without changing the HUD. */
export const EVACUEE_BRIEFING = [
  "Evacuee, listen carefully. You are in the central entrance corridor.",
  "A gas leak is spreading through the Science Block. Find the emergency backpack, retrieve the lab access card, and close the gas isolation valve.",
  "Read the safety clues in both blocks. Use the first-aid kit if your health drops, then return to the marked exit.",
  "The spectator sees threats you cannot. Trust physical signs, keep moving, and do not cross a route you have not decoded.",
];

export function speakNarration(text: string, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 0.9;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopNarration() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
