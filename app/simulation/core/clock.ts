export const DEFAULT_TICK_DURATION_SECONDS = 0.1;

export interface SimulationClock {
  tick: number;
  elapsedSeconds: number;
  tickDurationSeconds: number;
}

function validateTickDuration(tickDurationSeconds: number): void {
  if (!Number.isFinite(tickDurationSeconds) || tickDurationSeconds <= 0) {
    throw new Error("Simulation tick duration must be a positive finite number");
  }
}

function validateTickCount(ticks: number): void {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error("Simulation ticks must be a non-negative integer");
  }
}

export function createSimulationClock(
  tickDurationSeconds = DEFAULT_TICK_DURATION_SECONDS,
): SimulationClock {
  validateTickDuration(tickDurationSeconds);
  return {
    tick: 0,
    elapsedSeconds: 0,
    tickDurationSeconds,
  };
}

export function advanceSimulationClock(
  clock: SimulationClock,
  ticks = 1,
): SimulationClock {
  validateTickDuration(clock.tickDurationSeconds);
  validateTickCount(ticks);

  const nextTick = clock.tick + ticks;
  return {
    ...clock,
    tick: nextTick,
    elapsedSeconds: nextTick * clock.tickDurationSeconds,
  };
}

export function clockAtTick(clock: SimulationClock, tick: number): SimulationClock {
  validateTickCount(tick);
  validateTickDuration(clock.tickDurationSeconds);

  return {
    ...clock,
    tick,
    elapsedSeconds: tick * clock.tickDurationSeconds,
  };
}
