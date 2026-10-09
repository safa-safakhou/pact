// Extension records are operator-owned; the model has no path to modify them.
export function effectiveRequestCap(state) {
  let cap = state.config.requestCap;
  if (!state.extensions?.length) return cap;
  let end = state.originalEndsAt;
  for (const record of state.extensions) {
    if (
      state.mode !== "population" ||
      !record.authorization?.trim() ||
      record.previousEndsAt !== end ||
      record.previousRequestCap !== cap ||
      !Number.isSafeInteger(record.requestCap) ||
      record.requestCap < cap ||
      record.requestCap > 5000 ||
      !Number.isFinite(record.endsAt) ||
      record.endsAt <= end ||
      record.endsAt > state.startedAt + 8 * 3600000
    )
      throw Error("INVALID_AUTHORIZED_EXTENSION");
    cap = record.requestCap;
    end = record.endsAt;
  }
  if (state.endsAt !== end) throw Error("EXTENSION_DEADLINE_MISMATCH");
  return cap;
}

export function extendInterruptedRun(state, { runId, endsAt, requestCap, authorization }, now = Date.now()) {
  if (
    state.mode !== "population" ||
    state.runId !== runId ||
    !(state.status === "interrupted" || (state.status === "stopped" && state.stopReason === "STOP_FILE")) ||
    now >= state.endsAt
  )
    throw Error("ACTIVE_EXTENSION_REQUIRED");
  const oldCap = effectiveRequestCap(state);
  const candidate = structuredClone(state);
  candidate.originalEndsAt ??= state.endsAt;
  candidate.extensions ??= [];
  candidate.extensions.push({
    authorization,
    authorizedAt: now,
    previousEndsAt: state.endsAt,
    previousRequestCap: oldCap,
    endsAt,
    requestCap,
  });
  candidate.endsAt = endsAt;
  effectiveRequestCap(candidate);
  candidate.status = "interrupted";
  delete candidate.stopReason;
  return candidate;
}
