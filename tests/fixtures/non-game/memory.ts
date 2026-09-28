import type { ApprovalStore, ExactRequest } from "@pact/approvals/portable";
import type { SessionRecord, SessionStore } from "@pact/identity/portable";
import type { NotificationRecord, NotificationStore } from "@pact/inbox/portable";
import type { LeasePort } from "@pact/runs/portable";

const key = (...parts: string[]) => JSON.stringify(parts);
export class MemorySessions implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();
  put(scope: string, digest: string, record: SessionRecord) {
    this.records.set(key(scope, digest), { ...record });
  }
  get(scope: string, digest: string) {
    const row = this.records.get(key(scope, digest));
    return row ? { ...row } : undefined;
  }
  delete(scope: string, digest: string) {
    this.records.delete(key(scope, digest));
  }
}
export class MemoryLeases implements LeasePort {
  private readonly leases = new Map<string, { holder: string; deadline: number }>();
  constructor(private readonly now: () => number) {}
  acquire(scope: string, account: string, holder: string, deadline: number) {
    const id = key(scope, account),
      current = this.leases.get(id);
    if (current && current.deadline > this.now()) return false;
    this.leases.set(id, { holder, deadline });
    return true;
  }
  release(scope: string, account: string, holder: string) {
    const id = key(scope, account);
    if (this.leases.get(id)?.holder === holder) this.leases.delete(id);
  }
}
export class MemoryNotifications implements NotificationStore {
  private readonly events = new Map<string, NotificationRecord>();
  append(event: NotificationRecord) {
    const id = key(event.productScope, event.accountId, event.eventId);
    if (!this.events.has(id)) this.events.set(id, { ...event });
  }
  list(scope: string, account: string) {
    return [...this.events.values()]
      .filter((e) => e.productScope === scope && e.accountId === account)
      .map((e) => ({ ...e }));
  }
}
export class MemoryApprovals<T, R> implements ApprovalStore<T, R> {
  private readonly requests = new Map<string, ExactRequest<T>>();
  private readonly receipts = new Map<string, R>();
  private readonly committing = new Set<string>();
  constructor(private readonly checkpoint: () => () => void) {}
  put(request: ExactRequest<T>) {
    const id = key(request.owner.productScope, request.commandId),
      existing = this.requests.get(id);
    if (existing && (existing.hash !== request.hash || existing.owner.accountId !== request.owner.accountId))
      throw new Error("IDEMPOTENCY_CONFLICT");
    if (!existing) this.requests.set(id, structuredClone(request));
  }
  get(scope: string, commandId: string) {
    const row = this.requests.get(key(scope, commandId));
    return row ? structuredClone(row) : undefined;
  }
  commit(request: ExactRequest<T>, effect: () => R): R {
    const id = key(request.owner.productScope, request.commandId);
    if (this.receipts.has(id)) return structuredClone(this.receipts.get(id) as R);
    if (this.committing.has(id)) throw new Error("IN_FLIGHT");
    this.committing.add(id);
    const rollback = this.checkpoint();
    try {
      const receipt = effect();
      this.receipts.set(id, structuredClone(receipt));
      return receipt;
    } catch (error) {
      rollback();
      throw error;
    } finally {
      this.committing.delete(id);
    }
  }
}
