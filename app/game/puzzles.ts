/**
 * Scan puzzles.
 *
 * A warden taps a blip, answers one short question, and the thing is
 * identified. The question is a beat of tension, not a wall: every answer is
 * readable straight off the card, and the `hint` line says what the item
 * actually is, so a player who has never seen the room still knows what to
 * press. Nothing here needs a network round trip - the modal has a puzzle the
 * frame it opens.
 */

export interface Puzzle {
  question: string;
  options: string[];
  /** index into `options` */
  correct: number;
  /** what the warden is looking at, in one plain line */
  hint: string;
}

interface Entry {
  question: string;
  answer: string;
  wrong: [string, string];
  hint: string;
}

const BANK: Record<string, Entry> = {
  "sec-cam-b": {
    question: "This sensor has no status light, so the evacuee cannot spot it. What do you call out?",
    answer: "Keep out of its cone",
    wrong: ["Walk right past it", "Stand still in front of it"],
    hint: "A hidden sensor still reports exactly like a visible one.",
  },
  "vault-cam-b": {
    question: "A second sensor covers the archives with no light on it. What do you call out?",
    answer: "Keep out of its cone",
    wrong: ["Wave at the lens", "Stop underneath it"],
    hint: "A hidden sensor still reports exactly like a visible one.",
  },
  "sec-vent": {
    question: "A service hatch opens into this sector. What is it useful for?",
    answer: "A second route",
    wrong: ["Storing supplies", "Turning the lights on"],
    hint: "A service hatch provides another route through the building.",
  },
  "sec-trap": {
    question: "A pressure hazard reduces condition for anyone who steps on it. What do you call out?",
    answer: "Walk around it",
    wrong: ["Step on it once", "Run straight over it"],
    hint: "Floor hazard - contact reduces the evacuee's condition.",
  },
  "vault-trap": {
    question: "A pressure hazard reduces condition for anyone who steps on it. What do you call out?",
    answer: "Walk around it",
    wrong: ["Jump on it twice", "Stand on it and wait"],
    hint: "Floor hazard - contact reduces the evacuee's condition.",
  },
  alarm: {
    question: "Switching this panel off clears the sensor feed. Is that useful for the evacuee?",
    answer: "Yes - the feed clears",
    wrong: ["No - it calls security", "No - it locks the exit"],
    hint: "Emergency control panel. The evacuee activates it with E.",
  },
  note: {
    question: "The route notice reads 4 - 7 - 1 - 2. Relay it back exactly.",
    answer: "4-7-1-2",
    wrong: ["7-4-2-1", "1-2-4-7"],
    hint: "This is the emergency route code. Read it left to right.",
  },
  "sec-network": {
    question: "The node wants the next number in its sequence: 2, 4, 6, ?",
    answer: "8",
    wrong: ["9", "12"],
    hint: "Network node. Count up by two.",
  },
  "sec-coffee": {
    question: "The guard's coffee is still steaming. What does that tell you?",
    answer: "The guard is close by",
    wrong: ["The guard went home", "The room is empty tonight"],
    hint: "Hot coffee means somebody just put it down.",
  },
  bandages: {
    question: "Bandages restore 20 HP. Who should pick them up?",
    answer: "The evacuee",
    wrong: ["Security", "Nobody"],
    hint: "A stabilization kit sitting in the lobby.",
  },
  "lobby-guestlog": {
    question: "The guest log signs people in on the hour: 09:00, 10:00, 11:00, ?",
    answer: "12:00",
    wrong: ["11:30", "09:30"],
    hint: "Guest log. One entry every hour.",
  },
  "lobby-terminal": {
    question: "The reception terminal wants the next number: 3, 6, 9, ?",
    answer: "12",
    wrong: ["10", "15"],
    hint: "Reception terminal. Count up by three.",
  },
  valuables: {
    question: "These valuables are worth 150 to the score. What do you call out?",
    answer: "Take them",
    wrong: ["Leave them", "Break them"],
    hint: "Emergency supplies in the archives sector.",
  },
  "vault-vent": {
    question: "This vent goes straight out of the building. What is it for?",
    answer: "Reaching the assembly point",
    wrong: ["Storing supplies", "Calling security"],
    hint: "Service exit. Find it and the evacuee can reach the assembly point.",
  },
  "vault-deposit-box": {
    question: "The deposit box is numbered one higher than 41. Which box is it?",
    answer: "42",
    wrong: ["40", "14"],
    hint: "Safe deposit box. Add one to 41.",
  },
};

const FALLBACK: Entry = {
  question: "Run the scan on this object to log it for the response team?",
  answer: "Run the scan",
  wrong: ["Cancel the scan", "Wipe the log"],
  hint: "Scanning shares what you found with every connected warden.",
};

/** Tiny deterministic hash so an item's options do not reshuffle mid-answer. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 3;
}

/**
 * The puzzle for one marker. `attempt` moves the right answer to a different
 * slot on a retry, so a second try is still a read rather than a guess from
 * muscle memory.
 */
export function puzzleFor(id: string, attempt = 0): Puzzle {
  const entry = BANK[id] ?? FALLBACK;
  const slot = (hash(id) + attempt) % 3;
  const options = [...entry.wrong];
  options.splice(slot, 0, entry.answer);
  return {
    question: entry.question,
    options,
    correct: slot,
    hint: entry.hint,
  };
}

/** Shape check for a puzzle handed back by the AI route. */
export function isPuzzle(value: unknown): value is Puzzle {
  const p = value as Partial<Puzzle> | null;
  return (
    !!p &&
    typeof p.question === "string" &&
    p.question.length > 0 &&
    Array.isArray(p.options) &&
    p.options.length === 3 &&
    p.options.every((o) => typeof o === "string" && o.length > 0) &&
    typeof p.correct === "number" &&
    p.correct >= 0 &&
    p.correct < 3
  );
}
