type Signal = "command" | "alert" | "evidence" | "jump";

let context: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  context ??= new AudioContext();
  void context.resume();
  return context;
}

/** Deterministic local cues keep critical feedback available without audio services. */
export function playSignal(signal: Signal) {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const frequencies =
    signal === "alert"
      ? [110, 82]
      : signal === "jump"
        ? [150, 210]
      : signal === "evidence"
        ? [520, 760]
        : [240, 420];
  const duration = signal === "alert" ? 0.22 : signal === "jump" ? 0.08 : 0.1;

  frequencies.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = signal === "alert" ? "sawtooth" : signal === "jump" ? "triangle" : "square";
    const start = now + index * duration * 0.8;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  });
}
