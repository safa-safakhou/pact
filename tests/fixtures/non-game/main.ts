import assert from "node:assert/strict";
import { NotesApp, sharedMemory } from "./app.js";

const now = () => Date.parse("2026-09-28T00:00:00Z");
const app = new NotesApp("notes-alpha", sharedMemory(now), now);
const human = app.connectFixture("synthetic-owner", "human");
app.storeFixtureCredential(human, new Uint8Array([1, 2, 3]));
const run = app.start(human);
const proposal = await app.proposeFromModel(human, run);
assert.equal(app.published.version, 0);
assert.deepEqual(app.approve(human, proposal.commandId, proposal.action), {
  commandId: proposal.commandId,
  version: 1,
});
assert.equal(app.notifications.read(app.sessions.authenticate(human)).length, 1);
app.sessions.revoke(human);
assert.throws(() => app.sessions.authenticate(human), /INVALID_TOKEN/);
process.stdout.write(
  "PASS: independent non-game identity → bounded fake inference → exact human approval → receipt → notification → revoke\n",
);
