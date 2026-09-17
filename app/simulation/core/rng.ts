export interface SeededRandom {
  readonly seed: number;
  next(): number;
  nextInt(maxExclusive: number): number;
  fork(namespace: string): SeededRandom;
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new Error("Simulation seed must be a finite integer");
  }
  return seed >>> 0;
}

function hashNamespace(namespace: string): number {
  let hash = 2166136261;
  for (let index = 0; index < namespace.length; index += 1) {
    hash ^= namespace.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixSeed(seed: number, namespace: string): number {
  return (Math.imul(normalizeSeed(seed), 1664525) + hashNamespace(namespace) + 1013904223) >>> 0;
}

export function createSeededRandom(seed: number): SeededRandom {
  const normalizedSeed = normalizeSeed(seed);
  let state = normalizedSeed;

  return {
    seed: normalizedSeed,

    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },

    nextInt(maxExclusive) {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error("Random upper bound must be a positive integer");
      }
      return Math.floor(this.next() * maxExclusive);
    },

    fork(namespace) {
      return createSeededRandom(mixSeed(normalizedSeed, namespace));
    },
  };
}
