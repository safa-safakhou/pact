/** Deadlines use the committed projection clock. Rendering never advances game time. */
export function remainingGameTime(
  deadline: number,
  clock: { asOfGameTimeMs: number; worldStatus: string } | null,
): string {
  if (!clock || !Number.isFinite(deadline) || !Number.isFinite(clock.asOfGameTimeMs))
    return "Game deadline unavailable; refresh.";
  const minutes = Math.max(0, Math.ceil((deadline - clock.asOfGameTimeMs) / 60_000));
  const duration = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  const timing = minutes === 0 ? "Game deadline reached; refresh for settlement." : `${duration} game time remaining`;
  return `${timing} · ${clock.worldStatus === "active" ? "as of last refresh" : "clock paused"}`;
}
