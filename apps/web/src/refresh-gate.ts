/** One read refresh per UI generation. Switching players invalidates pending reads. */
export class RefreshGate {
  private active: symbol | null = null;
  private paused = false;

  begin(): symbol | null {
    if (this.paused || this.active !== null) return null;
    this.active = Symbol("refresh");
    return this.active;
  }

  isCurrent(ticket: symbol): boolean {
    return this.active === ticket;
  }

  finish(ticket: symbol): void {
    if (this.isCurrent(ticket)) this.active = null;
  }

  invalidate(): void {
    this.active = null;
  }

  pause(): void {
    this.paused = true;
    this.invalidate();
  }

  resume(): void {
    this.paused = false;
  }
}
