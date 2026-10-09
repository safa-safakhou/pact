export function nextActor(actors, now) {
  return actors
    .filter((a) => !a.blocked && a.nextDue <= now)
    .sort((a, b) => a.nextDue - b.nextDue || a.index - b.index)[0];
}

export function nextContinuousActor(state, now) {
  if (now < (state.nextTurnAt ?? 0)) return undefined;
  return nextActor(state.actors, now);
}

export function coolAfterTurn(state, now) {
  if (state.config.minimumTurnGapSeconds) state.nextTurnAt = now + state.config.minimumTurnGapSeconds * 1000;
}

export function finishTurn(actor, due, now, intervalMs) {
  // Coalesce missed periods; never catch up by issuing a burst of old plans.
  actor.nextDue = Math.max(due + intervalMs, now + intervalMs);
  actor.turns = (actor.turns ?? 0) + 1;
}

export function capacity(samples, intervals = [300, 600, 900], headroom = 0.3) {
  const values = samples.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!values.length) return null;
  const meanMs = values.reduce((a, b) => a + b, 0) / values.length;
  const p95Ms = values[Math.ceil(values.length * 0.95) - 1];
  return {
    samples: values.length,
    meanMs,
    p95Ms,
    headroom,
    projections: intervals.map((seconds) => ({
      seconds,
      meanAccounts: Math.floor(((1 - headroom) * seconds * 1000) / meanMs),
      p95Accounts: Math.floor(((1 - headroom) * seconds * 1000) / p95Ms),
    })),
  };
}
