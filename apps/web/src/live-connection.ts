/** A reconnect is not proof that the displayed decisions are fresh. No write queue. */
export class LiveConnection {
  private revision = 0;
  private online: boolean;
  private stale = false;

  constructor(online: boolean) {
    this.online = online;
    this.stale = !online;
  }

  get writable(): boolean {
    return this.online && !this.stale;
  }

  get status(): "live" | "offline" | "stale" {
    return !this.online ? "offline" : this.stale ? "stale" : "live";
  }

  invalidate(online = this.online): void {
    this.online = online;
    this.stale = true;
    this.revision++;
  }

  beginRefresh(): number {
    return this.revision;
  }

  confirmRefresh(revision: number): boolean {
    if (!this.online || revision !== this.revision) return false;
    this.stale = false;
    return true;
  }

  assertWrite(): void {
    if (!this.writable)
      throw new Error("LIVE_REFRESH_REQUIRED: Reconnect and refresh before deciding again. Nothing was queued.");
  }
}

/** Used by both the SDK transport and ordinary web handlers, including approvals/runs. */
export function liveFetch(send: typeof fetch, connection: LiveConnection, onUnavailable: () => void): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") connection.assertWrite();
    let response: Response;
    try {
      const timeout = AbortSignal.timeout(10_000);
      const supplied = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      response = await send(input, {
        ...init,
        signal: supplied ? AbortSignal.any([supplied, timeout]) : timeout,
      });
    } catch (error) {
      connection.invalidate();
      onUnavailable();
      throw error;
    }
    if (response.status >= 500) {
      connection.invalidate();
      onUnavailable();
    }
    return response;
  };
}
