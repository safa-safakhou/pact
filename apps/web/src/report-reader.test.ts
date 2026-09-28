import { describe, expect, it } from "vitest";
import { type ReportRead, ReportReader } from "./report-reader.js";

function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<unknown>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("selected report reads", () => {
  it("does not let a slow scout overwrite the later selected battle", async () => {
    const reader = new ReportReader();
    const first = deferred();
    const second = deferred();
    const states: ReportRead[] = [];
    const scout = reader.read(
      { kind: "scout", id: "old-scout" },
      () => first.promise,
      (state) => states.push(state),
    );
    const battle = reader.read(
      { kind: "raid_participant", id: "new-battle" },
      () => second.promise,
      (state) => states.push(state),
    );
    second.resolve({ winner: "defender" });
    await battle;
    first.resolve({ kind: "engine_report" });
    await scout;
    expect(states).toEqual([
      { kind: "scout", id: "old-scout", status: "loading" },
      { kind: "raid_participant", id: "new-battle", status: "loading" },
      { kind: "raid_participant", id: "new-battle", status: "ready", value: { winner: "defender" } },
    ]);
  });

  it("ignores a late failure after the current report succeeds", async () => {
    const reader = new ReportReader();
    const old = deferred();
    const states: ReportRead[] = [];
    const pending = reader.read(
      { kind: "scout", id: "old" },
      () => old.promise,
      (state) => states.push(state),
    );
    await reader.read(
      { kind: "raid_public", id: "current" },
      async () => "public",
      (state) => states.push(state),
    );
    old.reject(new Error("Failed to fetch"));
    await pending;
    expect(states.at(-1)).toEqual({ kind: "raid_public", id: "current", status: "ready", value: "public" });
    expect(states.some((state) => state.status === "failed")).toBe(false);
  });

  it("invalidates pending reads when leaving Chronicle or switching players", async () => {
    const reader = new ReportReader();
    for (const fail of [false, true]) {
      const result = deferred();
      const states: ReportRead[] = [];
      const pending = reader.read(
        { kind: "scout", id: "previous-player" },
        () => result.promise,
        (state) => states.push(state),
      );
      reader.invalidate();
      if (fail) result.reject(new Error("FORBIDDEN"));
      else result.resolve("private report");
      await pending;
      expect(states).toHaveLength(1);
      expect(states[0]?.status).toBe("loading");
    }
  });

  it("retains the requested identity and exposes the latest failure without retry", async () => {
    const reader = new ReportReader();
    const selection = { kind: "scout" as const, id: "requested" };
    const result = deferred();
    const states: ReportRead[] = [];
    let loads = 0;
    const pending = reader.read(
      selection,
      (kind, id) => {
        expect([kind, id]).toEqual(["scout", "requested"]);
        loads += 1;
        return result.promise;
      },
      (state) => states.push(state),
    );
    selection.id = "unsent-form-edit";
    const error = new Error("HTTP_503");
    result.reject(error);
    await pending;
    expect(states.at(-1)).toEqual({ kind: "scout", id: "requested", status: "failed", error });
    expect(loads).toBe(1);
  });
});
