import { createHash } from "node:crypto";
import type { ScopedPrincipal } from "@pact/identity/portable";

/** Caller supplies schema-normalized JSON. Shared with the PostgreSQL approval adapter. */
export function hashExactCommand(commandId: string, action: unknown): string {
  return createHash("sha256").update(JSON.stringify({ commandId, action }), "utf8").digest("hex");
}
export interface ExactRequest<T> {
  readonly owner: ScopedPrincipal;
  readonly commandId: string;
  readonly action: T;
  readonly hash: string;
  readonly expiresAt: number;
}
export interface ApprovalStore<T, R> {
  /** Store immutable copies; same command ID with changed content must fail. */
  put(request: ExactRequest<T>): void;
  get(scope: string, commandId: string): ExactRequest<T> | undefined;
  /** Must serialize per (product, command), commit effect+receipt together, and roll back on error. */
  commit(request: ExactRequest<T>, effect: () => R): R;
}
/** Product validators normalize action/preconditions; only authenticated humans can resolve it. */
export class ExactApprovals<T, R> {
  constructor(
    private readonly scope: string,
    private readonly store: ApprovalStore<T, R>,
    private readonly normalize: (raw: unknown) => T,
    private readonly now: () => number,
  ) {}
  propose(principal: ScopedPrincipal, commandId: string, raw: unknown): ExactRequest<T> {
    if (principal.productScope !== this.scope) throw new Error("FORBIDDEN");
    const action = this.normalize(raw);
    const request = {
      owner: { ...principal },
      commandId,
      action,
      hash: hashExactCommand(commandId, action),
      expiresAt: this.now() + 900000,
    };
    this.store.put(structuredClone(request));
    const stored = this.store.get(this.scope, commandId);
    if (!stored) throw new Error("NOT_FOUND");
    return structuredClone(stored);
  }
  approve(principal: ScopedPrincipal, commandId: string, raw: unknown, effect: (action: T) => R): R {
    const request = this.store.get(this.scope, commandId);
    if (!request) throw new Error("NOT_FOUND");
    if (
      principal.audience !== "human" ||
      principal.productScope !== this.scope ||
      request.owner.productScope !== this.scope ||
      principal.accountId !== request.owner.accountId
    )
      throw new Error("FORBIDDEN");
    if (request.expiresAt <= this.now()) throw new Error("EXPIRED");
    const action = this.normalize(raw);
    if (hashExactCommand(request.commandId, action) !== request.hash) throw new Error("INVALID_TERMS");
    return this.store.commit(request, () => effect(action));
  }
}
