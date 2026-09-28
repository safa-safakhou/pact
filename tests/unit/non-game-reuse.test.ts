import { expect, it } from "vitest";
import { NotesApp, sharedMemory } from "../fixtures/non-game/app.js";

function fixture() {
  let time = Date.parse("2026-09-28T00:00:00Z");
  const now = () => time;
  const memory = sharedMemory(now);
  const a = new NotesApp("notes-alpha", memory, now),
    b = new NotesApp("notes-beta", memory, now);
  const human = a.connectFixture("same-account", "human"),
    agent = a.connectFixture("same-account", "agent");
  a.storeFixtureCredential(human, new Uint8Array([1, 2, 3]));
  return {
    a,
    b,
    human,
    agent,
    memory,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
it("completes one bounded proposal, exact approval, receipt and idempotent notification", async () => {
  const f = fixture(),
    run = f.a.start(f.human);
  const proposal = await f.a.proposeFromModel(f.human, run);
  expect(run.usage).toEqual({ calls: 1, tokens: 19 });
  expect(f.a.published.version).toBe(0);
  expect(() => f.a.approve(f.agent, proposal.commandId, proposal.action)).toThrow("FORBIDDEN");
  expect(() => f.a.approve(f.human, proposal.commandId, { ...proposal.action, text: "Changed" })).toThrow(
    "INVALID_TERMS",
  );
  const receipt = f.a.approve(f.human, proposal.commandId, proposal.action);
  expect(f.a.approve(f.human, proposal.commandId, proposal.action)).toEqual(receipt);
  expect(f.a.published).toEqual({ version: 1, text: "Synthetic notice" });
  expect(f.a.notifications.read(f.a.sessions.authenticate(f.human))).toHaveLength(1);
  expect(f.a.providerCalls).toBe(1);
  await expect(f.a.proposeFromModel(f.human, run)).rejects.toThrow("ALLOWANCE_EXHAUSTED");
  expect(f.a.providerCalls).toBe(1);
});
it("isolates credentials, sessions, approvals, events and leases across products sharing an account ID", async () => {
  const f = fixture();
  expect(() => f.b.sessions.authenticate(f.human)).toThrow("INVALID_TOKEN");
  const beta = f.b.connectFixture("same-account", "human");
  expect(() => f.b.credential(beta)).toThrow("NOT_FOUND");
  const runA = f.a.start(f.human),
    runB = f.b.start(beta);
  await expect(f.b.proposeFromModel(beta, runA)).rejects.toThrow("FORBIDDEN");
  expect(() => f.a.start(f.human)).toThrow("RUN_ALREADY_ACTIVE");
  const request = await f.a.proposeFromModel(f.human, runA);
  expect(() => f.b.approve(beta, request.commandId, request.action)).toThrow("NOT_FOUND");
  f.a.approve(f.human, request.commandId, request.action);
  expect(f.b.notifications.read(f.b.sessions.authenticate(beta))).toEqual([]);
  expect(() => f.b.notifications.read(f.a.sessions.authenticate(f.human))).toThrow("FORBIDDEN");
  runB.stop();
  f.a.sessions.revoke(f.human);
  expect(() => f.a.sessions.authenticate(f.human)).toThrow("INVALID_TOKEN");
  expect(f.b.sessions.authenticate(beta).productScope).toBe("notes-beta");
});
it("denies nonowners, expired approval/session and changed replay without new effects", async () => {
  const f = fixture();
  const request = await f.a.proposeFromModel(f.human, f.a.start(f.human));
  const outsider = f.a.connectFixture("outsider", "human");
  expect(() => f.a.approve(outsider, request.commandId, request.action)).toThrow("FORBIDDEN");
  // The caller's returned proposal is not the stored authorization record.
  const mutated = { ...request.action, expectedVersion: 2 };
  expect(() => f.a.approvals.propose(f.a.sessions.authenticate(f.human), request.commandId, mutated)).toThrow(
    "IDEMPOTENCY_CONFLICT",
  );
  f.advance(1000);
  expect(f.a.approvals.propose(f.a.sessions.authenticate(f.human), request.commandId, request.action).expiresAt).toBe(
    request.expiresAt,
  );
  f.advance(899000);
  expect(() => f.a.sessions.authenticate(f.human)).toThrow("INVALID_TOKEN");
  const fresh = f.a.connectFixture("same-account", "human");
  expect(() => f.a.approve(fresh, request.commandId, request.action)).toThrow("EXPIRED");
  expect(f.a.published.version).toBe(0);
});
it("rolls back a stale approval and never runs inference from a notification", async () => {
  const f = fixture(),
    owner = f.a.sessions.authenticate(f.human);
  const stale = f.a.approvals.propose(owner, "synthetic-stale", {
    type: "note.publish.v1",
    text: "Stale",
    expectedVersion: 2,
  });
  expect(() => f.a.approve(f.human, stale.commandId, stale.action)).toThrow("STALE_VERSION");
  expect(f.a.published.version).toBe(0);
  f.a.notifications.publish({
    productScope: f.a.scope,
    accountId: owner.accountId,
    eventId: "event-1",
    type: "note.requested.v1",
  });
  f.a.notifications.read(owner);
  expect(f.a.providerCalls).toBe(0);
});
it("rejects agent starts, invalid limits and concurrent requests, retaining failed usage", async () => {
  const f = fixture();
  expect(() => f.a.start(f.agent)).toThrow("FORBIDDEN");
  expect(() => f.a.start(f.human, 21)).toThrow("INVALID_LIMITS");
  const run = f.a.start(f.human, 2, 100);
  let finish: (() => void) | undefined;
  const pending = run.step(10, async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    throw new Error("Synthetic timeout");
  });
  await expect(run.step(10, async () => ({ value: 1 }))).rejects.toThrow("IN_FLIGHT");
  finish?.();
  await expect(pending).rejects.toThrow("Synthetic timeout");
  expect(run.usage).toEqual({ calls: 1, tokens: 100 });
  expect(() => f.a.start(f.human)).not.toThrow();
});
it("does not commit results after stop or extend the deadline", async () => {
  const f = fixture(),
    run = f.a.start(f.human, 2);
  await expect(
    run.step(10, async () => {
      run.stop();
      return { value: "discard", tokens: 1 };
    }),
  ).rejects.toThrow("RUN_STOPPED");
  const next = f.a.start(f.human, 2);
  f.advance(900000);
  await expect(next.step(10, async () => ({ value: "never" }))).rejects.toThrow("ALLOWANCE_EXHAUSTED");
});
it("restores a mutated document after commit failure and allows an exact retry", () => {
  const f = fixture(),
    principal = f.a.sessions.authenticate(f.human);
  const request = f.a.approvals.propose(principal, "rollback-fixture", {
    type: "note.publish.v1",
    text: "Retry",
    expectedVersion: 0,
  });
  expect(() =>
    f.memory.approvals.commit(request, () => {
      f.memory.documents.set(f.a.scope, { version: 1, text: "Must roll back" });
      throw new Error("Synthetic post-effect fault");
    }),
  ).toThrow("Synthetic post-effect fault");
  expect(f.a.published.version).toBe(0);
  expect(f.a.approve(f.human, request.commandId, request.action)).toEqual({ commandId: request.commandId, version: 1 });
});
