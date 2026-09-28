import type { ScopedPrincipal } from "@pact/identity/portable";

export const runDefaults = Object.freeze({
  durationMs: 900000,
  maxConversations: 6,
  maxMessages: 12,
  maxCalls: 20,
  maxTokens: 40000,
} as const);
export function withinRunLimit(value: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= max;
}
export interface LeasePort {
  acquire(scope: string, account: string, holder: string, deadline: number): boolean;
  release(scope: string, account: string, holder: string): void;
}
/** Explicit-start, one-request-at-a-time host kernel; storage and domain tools are injected. */
export class BoundedRun {
  private inFlight = false;
  private stopped = false;
  private usedCalls = 0;
  private usedTokens = 0;
  readonly deadline: number;
  constructor(
    private readonly principal: ScopedPrincipal,
    private readonly holder: string,
    private readonly leases: LeasePort,
    private readonly now: () => number,
    private readonly limits: { maxCalls: number; maxTokens: number; durationMs: number },
  ) {
    this.principal = { ...principal };
    this.limits = { ...limits };
    if (principal.audience !== "human") throw new Error("FORBIDDEN");
    if (
      !withinRunLimit(limits.maxCalls, runDefaults.maxCalls) ||
      !withinRunLimit(limits.maxTokens, runDefaults.maxTokens) ||
      !withinRunLimit(limits.durationMs, runDefaults.durationMs)
    )
      throw new Error("INVALID_LIMITS");
    this.deadline = now() + limits.durationMs;
    if (!leases.acquire(principal.productScope, principal.accountId, holder, this.deadline))
      throw new Error("RUN_ALREADY_ACTIVE");
  }
  get usage() {
    return { calls: this.usedCalls, tokens: this.usedTokens };
  }
  assertOwner(principal: ScopedPrincipal): void {
    if (principal.productScope !== this.principal.productScope || principal.accountId !== this.principal.accountId)
      throw new Error("FORBIDDEN");
  }
  stop(): void {
    this.stopped = true;
    this.leases.release(this.principal.productScope, this.principal.accountId, this.holder);
  }
  async step<T>(
    estimatedInput: number,
    invoke: (outputCeiling: number) => Promise<{ value: T; tokens?: number }>,
  ): Promise<T> {
    if (this.inFlight) throw new Error("IN_FLIGHT");
    if (this.stopped || this.now() >= this.deadline || this.usedCalls >= this.limits.maxCalls) {
      this.stop();
      throw new Error("ALLOWANCE_EXHAUSTED");
    }
    const remaining = this.limits.maxTokens - this.usedTokens;
    if (!Number.isSafeInteger(estimatedInput) || estimatedInput < 0 || estimatedInput >= remaining) {
      this.stop();
      throw new Error("ALLOWANCE_EXHAUSTED");
    }
    const outputCeiling = Math.min(2000, remaining - estimatedInput);
    this.inFlight = true;
    this.usedCalls++;
    // Unknown/failed invocation conservatively retains the full reservation. Never auto-retry.
    const reservation = estimatedInput + outputCeiling;
    this.usedTokens += reservation;
    try {
      const result = await invoke(outputCeiling);
      if (this.stopped || this.now() >= this.deadline) throw new Error("RUN_STOPPED");
      if (result.tokens !== undefined) {
        if (!Number.isSafeInteger(result.tokens) || result.tokens < 0) throw new Error("INVALID_USAGE");
        this.usedTokens += result.tokens - reservation;
      }
      return result.value;
    } catch (error) {
      this.stop();
      throw error;
    } finally {
      this.inFlight = false;
      if (this.usedCalls >= this.limits.maxCalls || this.usedTokens >= this.limits.maxTokens) this.stop();
    }
  }
}
