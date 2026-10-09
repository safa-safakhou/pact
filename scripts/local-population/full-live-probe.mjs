import path from "node:path";
import { PublicClient } from "../population/client.mjs";
import { dispatchFullCommand, prepareFullCommand, recoverFullCommand } from "./full-game.mjs";
import { atomicJson, RunStore } from "./state.mjs";

// Finite operator verification on existing opted-in synthetic owners, using the released adapter.
if (process.argv[2] !== "--state" || !process.argv[3]) throw Error("STATE_REQUIRED");
const store = new RunStore(process.argv[3]);
const state = store.read(),
  checks = [],
  deadline = Date.now() + 120000;
const active = () => Date.now() < deadline && !store.stopped() && checks.length < 20;
const save = () => store.save(state);
const emit = () => {};
const actors = state.actors.slice(0, 2),
  clients = actors.map((a) => new PublicClient(state.config.base, a, save));
const sessions = [];
async function command(index, action) {
  const actor = actors[index],
    client = clients[index],
    mcp = sessions[index];
  const pending = await prepareFullCommand(actor, action, client);
  if (pending.role === "synthetic-owner") actor.ownerDecisions++;
  const receipt = await dispatchFullCommand({ actor, pending, client, mcp, save, emit, active });
  checks.push({
    actor: index,
    action: pending.action.token ? { ...pending.action, token: "[REDACTED]" } : pending.action,
    code: receipt.code,
    commandId: receipt.commandId,
    records: receipt.recordVersions,
  });
  if (receipt.code !== "COMMITTED") throw Error(`PROBE_${receipt.code}`);
  return receipt;
}
try {
  if (state.mode !== "full-game-continuous" || actors.length !== 2) throw Error("PROBE_STATE_INVALID");
  for (const client of clients) sessions.push(await client.mcp());
  if (process.argv.includes("--messages")) {
    const issued = await command(0, {
      kind: "invitation.issue",
      destinationType: "contact",
      destinationId: actors[0].kingdomId,
    });
    if (!issued.ownerResult?.token) throw Error("INVITATION_RESULT_MISSING");
    await command(1, { kind: "invitation.accept", token: issued.ownerResult.token });
    await sessions[1].call("pact_conversation_read_v1", { counterpartyKingdomId: actors[0].kingdomId, limit: 5 });
    let opens = 0;
    const call = sessions[0].call.bind(sessions[0]);
    sessions[0].call = async (name, args) => {
      if (name === "run.open") opens++;
      return call(name, args);
    };
    await command(0, {
      kind: "game.message.send",
      recipientKingdomId: actors[1].kingdomId,
      body: "[Local model verification] Our Court is established; discuss a sustainable strategy.",
    });
    await command(0, {
      kind: "game.message.send",
      recipientKingdomId: actors[1].kingdomId,
      body: "[Local model verification] This second message verifies lease reuse in the same connection.",
    });
    if (opens !== 1) throw Error("LEASE_NOT_REUSED");
    atomicJson(path.join(store.dir, "full-message-probe.json"), {
      observedAt: new Date().toISOString(),
      checks,
      leaseOpens: opens,
      inferenceRequests: 0,
    });
    console.log(JSON.stringify({ checks: checks.length, leaseOpens: opens, allCommitted: true }));
  } else {
    const previous = actors[0].pending;
    let recovered;
    for (const [index, actor] of actors.entries()) {
      const receipt = await recoverFullCommand({
        actor,
        client: clients[index],
        mcp: sessions[index],
        save,
        emit,
        active,
      });
      if (index === 0) recovered = receipt;
    }
    const handle =
      previous?.action.kind === "court.create" ? previous.action.handle : `qwen_${Date.now().toString(36)}`;
    const created =
      previous?.action.kind === "court.create" && recovered
        ? recovered
        : await command(0, {
            kind: "court.create",
            handle,
            title: "Local Envoy Council",
            description: "Synthetic full-game players exploring trade, strategy and Court coordination.",
            joinMode: "open",
          });
    if (previous)
      checks.push({ name: "same_id_receipt_recovery", commandId: previous.commandId, code: recovered.code });
    const courtId = Object.keys(created.recordVersions)
      .find((key) => key.startsWith("court:"))
      .slice(6);
    await command(1, { kind: "court.join", courtId });
    await command(0, {
      kind: "court.pin",
      courtId,
      slot: 1,
      body: "Coordinate sustainable trade and training. Engine receipts establish outcomes; player prose remains a claim.",
    });
    const court = await sessions[1].call("pact_court_read_v1", { handle });
    checks.push({ name: "court_read_after_join", observed: court });
    await command(0, {
      kind: "article.publish",
      title: "An Envoy's priorities",
      body: "I seek sustainable development and negotiated cooperation. This is a synthetic player's declaration, not an engine guarantee.",
    });
    await command(0, {
      kind: "chronicle.publish",
      selection: {
        type: "notice",
        title: "Local council open",
        commentary:
          "The synthetic Envoy council is open for strategic discussion. Contracts require their ordinary signatures.",
        courtHandle: handle,
        durationHours: 1,
      },
      previewDigest: "0".repeat(64),
    });
    await command(0, { kind: "game.training.queue", type: "spearman", count: 2 });
    atomicJson(path.join(store.dir, "full-live-probe.json"), {
      observedAt: new Date().toISOString(),
      checks,
      inferenceRequests: 0,
      courtHandle: handle,
      courtId,
      note: "Normal synthetic-owner Court/publication/training routes; no stock minted, no server authority bypass, no historical runner reset.",
    });
    console.log(JSON.stringify({ checks: checks.length, allCommitted: true, courtHandle: handle }));
  }
} finally {
  for (const session of sessions) await session.close();
  store.close();
}
