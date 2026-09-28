import { describe, expect, it } from "vitest";
import { RefreshGate } from "./refresh-gate.js";

describe("world refresh admission", () => {
  it("coalesces overlapping poll, stream and manual refreshes", () => {
    const gate = new RefreshGate();
    const ticket = gate.begin();
    expect(ticket).not.toBeNull();
    expect(gate.begin()).toBeNull();
    gate.finish(ticket as symbol);
    expect(gate.begin()).not.toBeNull();
  });

  it("rejects a previous player's completion without releasing the next refresh", () => {
    const gate = new RefreshGate();
    const old = gate.begin() as symbol;
    gate.invalidate();
    const current = gate.begin() as symbol;
    expect(gate.isCurrent(old)).toBe(false);
    expect(gate.isCurrent(current)).toBe(true);
    gate.finish(old);
    expect(gate.begin()).toBeNull();
    gate.finish(current);
    expect(gate.begin()).not.toBeNull();
  });

  it("does not admit a delayed result after switching to the sign-in form", async () => {
    const gate = new RefreshGate();
    const ticket = gate.begin() as symbol;
    let complete: (value: string) => void = () => undefined;
    const read = new Promise<string>((resolve) => {
      complete = resolve;
    });
    const rendered: string[] = [];
    const pending = read.then((value) => {
      if (gate.isCurrent(ticket)) rendered.push(value);
      gate.finish(ticket);
    });
    gate.invalidate();
    complete("previous kingdom");
    await pending;
    expect(rendered).toEqual([]);
  });

  it("ignores queued stream callbacks on the sign-in form until successful login", () => {
    const gate = new RefreshGate();
    const ticket = gate.begin() as symbol;
    gate.pause();
    expect(gate.isCurrent(ticket)).toBe(false);
    expect(gate.begin()).toBeNull();
    gate.finish(ticket);
    expect(gate.begin()).toBeNull();
    gate.resume();
    expect(gate.begin()).not.toBeNull();
  });
});
