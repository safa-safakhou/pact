export const GAME_MINUTE_MS = 60_000;

export function nextGameMinuteStrict(gameTimeMs: number): number {
  if (!Number.isSafeInteger(gameTimeMs) || gameTimeMs < 0) throw new Error("INVALID_GAME_TIME");
  const next = (Math.floor(gameTimeMs / GAME_MINUTE_MS) + 1) * GAME_MINUTE_MS;
  if (!Number.isSafeInteger(next)) throw new Error("INVALID_GAME_TIME");
  return next;
}

export function timedJobDeadline(gameTimeMs: number, durationMinutes: number): number {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 0) throw new Error("INVALID_DURATION");
  const deadline = nextGameMinuteStrict(gameTimeMs) + durationMinutes * GAME_MINUTE_MS;
  if (!Number.isSafeInteger(deadline)) throw new Error("INVALID_GAME_TIME");
  return deadline;
}

export const TICK_PHASES = [
  "season_rollover",
  "boundaries_and_completions",
  "production",
  "upkeep",
  "capture_obligations",
  "settle_deliveries",
  "defaults_and_bonds",
  "battle_and_scouts",
  "views_and_achievements",
] as const;
export type TickPhase = (typeof TICK_PHASES)[number];
