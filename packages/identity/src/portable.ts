import type { TokenDigester } from "./crypto.js";

export interface ScopedPrincipal {
  readonly productScope: string;
  readonly accountId: string;
  readonly audience: "human" | "agent";
}
export interface SessionRecord extends ScopedPrincipal {
  readonly expiresAt: number;
}
export interface SessionStore {
  put(scope: string, digest: string, record: SessionRecord): void;
  get(scope: string, digest: string): SessionRecord | undefined;
  delete(scope: string, digest: string): void;
}
/** Storage-neutral opaque sessions; adapters own transport, storage and account verification. */
export class ScopedSessions {
  constructor(
    private readonly scope: string,
    private readonly store: SessionStore,
    private readonly digester: TokenDigester,
    private readonly now: () => number,
  ) {}
  issue(principal: ScopedPrincipal, durationMs = 900000): string {
    if (
      principal.productScope !== this.scope ||
      !Number.isSafeInteger(durationMs) ||
      durationMs < 1 ||
      durationMs > 900000
    )
      throw new Error("FORBIDDEN");
    const token = this.digester.issue();
    this.store.put(this.scope, token.hash, { ...principal, expiresAt: this.now() + durationMs });
    return token.raw;
  }
  authenticate(token: string): ScopedPrincipal {
    const record = this.store.get(this.scope, this.digester.digest(token));
    if (!record || record.productScope !== this.scope || record.expiresAt <= this.now())
      throw new Error("INVALID_TOKEN");
    return { productScope: record.productScope, accountId: record.accountId, audience: record.audience };
  }
  revoke(token: string): void {
    this.store.delete(this.scope, this.digester.digest(token));
  }
}
export { AesGcmSecretBox, TokenDigester } from "./crypto.js";
