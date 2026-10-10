import { createHash, randomUUID } from "node:crypto";
import { GameActionV2Schema } from "@pact/contracts";
import { z } from "zod";

const Plan = z.object({ action: GameActionV2Schema.nullable() }).strict();
export type RunnerRoute = "ollama" | "codex-luna" | "codex-astra";
export interface TurnState {
  ownerId: string;
  route: RunnerRoute;
  model: string;
  deadline: number;
  callCeiling: number;
  tokenCeiling: number;
  perCallTokenCeiling: number;
  calls: number;
  allocatedTokens: number;
  observedInputTokens: number;
  observedOutputTokens: number;
  nextEligibleAt: number;
  status: "ready" | "pending" | "stopped" | "needs_owner" | "finished";
  pending: { commandId: string; action: z.infer<typeof GameActionV2Schema> } | null;
}
export interface ModelPort {
  /** Operator-installed decision transport only. No game token, tools, files, shell or human credentials. */
  decide(input: { model: string; facts: unknown; schema: unknown; signal: AbortSignal }): Promise<{
    plan: unknown;
    inputTokens: number | null;
    outputTokens: number | null;
  }>;
}
export interface GamePort {
  /** Must verify the authenticated grant's subject and acquire the existing kingdom lease. */
  open(ownerId: string, deadline: number): Promise<void>;
  observe(): Promise<unknown>;
  receipt(commandId: string): Promise<{ code: string; commandId: string }>;
  command(pending: NonNullable<TurnState["pending"]>): Promise<{ code: string; commandId: string }>;
  close(): Promise<void>;
}
export const turnPlanSchema = z.toJSONSchema(Plan, { target: "draft-7", unrepresentable: "any" });
const fingerprint = (s: TurnState) =>
  createHash("sha256")
    .update(
      JSON.stringify([s.ownerId, s.route, s.model, s.deadline, s.callCeiling, s.tokenCeiling, s.perCallTokenCeiling]),
    )
    .digest("hex");
/** No CLI launch, task creation, account provisioning, grant expansion or model fallback. */
export async function boundedTurn(input: {
  state: TurnState;
  expectedFingerprint: string;
  certifiedRoute: boolean;
  model: ModelPort;
  game: GamePort;
  save: (state: TurnState) => Promise<void>;
  now: () => number;
  stopped: () => boolean;
}): Promise<{ code: string; fingerprint: string }> {
  const { state: s, game, save, now, stopped } = input;
  const original = fingerprint(s);
  if (original !== input.expectedFingerprint) throw Error("RUNNER_SETTINGS_CHANGED");
  if (!input.certifiedRoute) throw Error("ROUTE_NOT_CERTIFIED");
  if (
    !s.ownerId ||
    !s.model ||
    !Number.isSafeInteger(s.deadline) ||
    !Number.isSafeInteger(s.callCeiling) ||
    s.callCeiling < 1 ||
    s.callCeiling > 20 ||
    !Number.isSafeInteger(s.perCallTokenCeiling) ||
    s.perCallTokenCeiling < 1 ||
    s.perCallTokenCeiling > 40_000 ||
    !Number.isSafeInteger(s.tokenCeiling) ||
    s.tokenCeiling < s.perCallTokenCeiling ||
    !Number.isSafeInteger(s.calls) ||
    s.calls < 0 ||
    !Number.isSafeInteger(s.allocatedTokens) ||
    s.allocatedTokens < 0
  )
    throw Error("INVALID_RUNNER_BUDGET");
  const active = () => !stopped() && now() < s.deadline;
  if (!active() || ["stopped", "finished", "needs_owner"].includes(s.status)) {
    s.status = stopped() ? "stopped" : s.status === "needs_owner" ? "needs_owner" : "finished";
    await save(s);
    return { code: "TERMINAL", fingerprint: original };
  }
  if (now() < s.nextEligibleAt) return { code: "COOLING", fingerprint: original };
  let opened = false;
  try {
    await game.open(s.ownerId, s.deadline);
    opened = true;
    if (s.pending) {
      let r = await game.receipt(s.pending.commandId);
      if (r.commandId !== s.pending.commandId) throw Error("RECEIPT_MISMATCH");
      if (r.code === "RECEIPT_NOT_FOUND" && active()) r = await game.command(structuredClone(s.pending));
      if (r.commandId !== s.pending.commandId) throw Error("RECEIPT_MISMATCH");
      if (r.code === "RECEIPT_NOT_FOUND") throw Error("UNCERTAIN_COMMAND");
      s.pending = null;
      s.status = "ready";
      s.nextEligibleAt = now() + 60_000;
      await save(s);
      return { code: r.code, fingerprint: original };
    }
    if (s.calls >= s.callCeiling || s.allocatedTokens + s.perCallTokenCeiling > s.tokenCeiling) {
      s.status = "finished";
      await save(s);
      return { code: "BUDGET_EXHAUSTED", fingerprint: original };
    }
    const facts = await game.observe();
    if (!active()) return { code: "STOPPED_BEFORE_DISPATCH", fingerprint: original };
    s.calls++;
    s.allocatedTokens += s.perCallTokenCeiling;
    s.status = "needs_owner"; // A crash after allocation never causes an uncounted/replacement call.
    await save(s);
    const output = await input.model.decide({
      model: s.model,
      facts,
      schema: turnPlanSchema,
      signal: AbortSignal.timeout(Math.max(1, Math.min(60_000, s.deadline - now()))),
    });
    for (const n of [output.inputTokens, output.outputTokens])
      if (n !== null && (!Number.isSafeInteger(n) || n < 0)) throw Error("INVALID_MODEL_USAGE");
    s.observedInputTokens += output.inputTokens ?? 0;
    s.observedOutputTokens += output.outputTokens ?? 0;
    if ((output.inputTokens ?? 0) + (output.outputTokens ?? 0) > s.perCallTokenCeiling)
      throw Error("MODEL_USAGE_EXCEEDED_ALLOCATION");
    const plan = Plan.parse(output.plan);
    s.nextEligibleAt = now() + 60_000;
    if (!active()) {
      s.status = stopped() ? "stopped" : "finished";
      await save(s);
      return { code: "STOPPED_AFTER_DECISION", fingerprint: original };
    }
    if (!plan.action) {
      s.status = "ready";
      await save(s);
      return { code: "WAIT", fingerprint: original };
    }
    s.pending = { commandId: randomUUID(), action: plan.action };
    s.status = "pending";
    await save(s); // Exact identity/version/body persisted before any commitment.
    const receipt = await game.command(structuredClone(s.pending));
    if (receipt.commandId !== s.pending.commandId || receipt.code === "RECEIPT_NOT_FOUND")
      throw Error("UNCERTAIN_COMMAND");
    s.pending = null;
    s.status = "ready";
    await save(s);
    return { code: receipt.code, fingerprint: original };
  } catch {
    s.status = s.pending ? "pending" : "needs_owner";
    await save(s);
    return { code: s.pending ? "UNCERTAIN_COMMAND" : "NEEDS_OWNER", fingerprint: original };
  } finally {
    if (opened) await game.close();
  }
}
export function turnSettingsFingerprint(state: TurnState): string {
  return fingerprint(state);
}
