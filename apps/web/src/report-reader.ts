export type ReportKind = "scout" | "raid_participant" | "raid_public";
export type ReportSelection = { kind: ReportKind; id: string };
export type ReportRead = ReportSelection &
  ({ status: "loading" } | { status: "ready"; value: unknown } | { status: "failed"; error: unknown });

/** New selections supersede old reads; leaving Chronicle invalidates pending completions. */
export class ReportReader {
  private current: symbol | null = null;

  invalidate(): void {
    this.current = null;
  }

  async read(
    selection: ReportSelection,
    load: (kind: ReportKind, id: string) => Promise<unknown>,
    publish: (state: ReportRead) => void,
  ): Promise<void> {
    const ticket = Symbol("report");
    this.current = ticket;
    const selected = { ...selection };
    publish({ ...selected, status: "loading" });
    try {
      const value = await load(selected.kind, selected.id);
      if (this.current === ticket) publish({ ...selected, status: "ready", value });
    } catch (error: unknown) {
      if (this.current === ticket) publish({ ...selected, status: "failed", error });
    }
  }
}
