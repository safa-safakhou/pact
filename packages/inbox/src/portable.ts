import type { ScopedPrincipal } from "@pact/identity/portable";

export interface NotificationRecord {
  readonly productScope: string;
  readonly accountId: string;
  readonly eventId: string;
  readonly type: string;
}
export interface NotificationStore {
  append(event: NotificationRecord): void;
  list(scope: string, account: string): readonly NotificationRecord[];
}
/** Payload-free notifications; no model/provider or command execution capability. */
export class ScopedNotifications {
  constructor(
    private readonly scope: string,
    private readonly store: NotificationStore,
  ) {}
  publish(event: NotificationRecord): void {
    if (event.productScope !== this.scope) throw new Error("FORBIDDEN");
    this.store.append({ ...event });
  }
  read(principal: ScopedPrincipal): readonly NotificationRecord[] {
    if (principal.productScope !== this.scope) throw new Error("FORBIDDEN");
    return this.store
      .list(this.scope, principal.accountId)
      .filter((e) => e.productScope === this.scope && e.accountId === principal.accountId)
      .map((e) => ({ ...e }));
  }
}
