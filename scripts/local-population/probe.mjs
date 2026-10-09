import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PublicClient } from "../population/client.mjs";
import { readConfig } from "./config.mjs";
import { approveOwnerAction, OWNER_POLICY } from "./owner.mjs";
import { actionAvailable, pacedGuide, recordOutcome } from "./pacing.mjs";
import { validateAction } from "./plan.mjs";
import { executeAction } from "./runner.mjs";
import { atomicJson, RunStore } from "./state.mjs";

// Deliberate public-interface lifecycle coverage, no model inference or database writes.
const { dir, config } = readConfig();
const store = new RunStore(dir);
const state = {
  mode: "verification",
  config,
  startedAt: Date.now(),
  endsAt: Date.now() + 120000,
  status: "running",
  requests: 0,
  actors: [0, 1].map((index) => ({
    index,
    ownerPolicy: OWNER_POLICY,
    nickname: `Local verify ${Date.now().toString(36)} ${index + 1}`,
    entryKey: randomUUID(),
  })),
};
const save = () => store.save(state);
const emit = (type, data) =>
  fs.appendFileSync(
    path.join(dir, "events.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), type, ...data })}\n`,
  );
const active = () => Date.now() < state.endsAt && !store.stopped();
const checks = [];
let dispatches = 0;
const clients = state.actors.map((a) => new PublicClient(config.base, a, save));
const sessions = [];
const command = async (index, action) => {
  if (!active() || ++dispatches > 40) throw Error("PROBE_LIMIT");
  const result = await executeAction({
    actor: state.actors[index],
    action,
    client: clients[index],
    mcp: sessions[index],
    save,
    emit,
    active,
  });
  return result;
};
const expectCode = (name, result, code) => {
  if (result.code !== code) throw Error(`${name}_${result.code}`);
  checks.push({ name, code: result.code });
  return result;
};
try {
  if (store.read()) throw Error("PROBE_REQUIRES_NEW_STATE");
  save();
  for (const client of clients) {
    if (!active()) throw Error("PROBE_LIMIT");
    await client.provision();
  }
  const [a, b] = state.actors;
  // Owner-issued contact invitation is the ordinary no-fee friends route, not minted stock.
  const invitation = await clients[0].http("/v1/social/commands", {
    schemaVersion: "pact.social-command.v1",
    commandId: randomUUID(),
    action: { kind: "invitation.issue", destinationType: "contact", destinationId: a.kingdomId, redemptionLimit: 1 },
  });
  const token = invitation.invitation?.token ?? invitation.result?.token ?? invitation.token;
  if (!token) throw Error("INVITATION_TOKEN_MISSING");
  await clients[1].http("/v1/social/commands", {
    schemaVersion: "pact.social-command.v1",
    commandId: randomUUID(),
    action: { kind: "invitation.accept", token },
  });
  for (const client of clients) {
    const mcp = await client.mcp();
    sessions.push(mcp);
    await mcp.call("run.open");
  }
  const terms = {
    aToB: { resource: "grain", wholePerHour: 3 },
    bToA: { resource: "iron", wholePerHour: 3 },
    aBond: null,
    bBond: null,
    durationHours: 1,
    noticeHours: 0,
  };
  const offered = expectCode(
    "formal_offer",
    await command(0, { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms }),
    "COMMITTED",
  );
  const offerId = Object.keys(offered.recordVersions)
    .find((k) => k.startsWith("supply-offer:"))
    .slice(13);
  expectCode("first_signature", await command(0, { kind: "game.supply.sign", offerId, version: 1 }), "COMMITTED");
  const changed = { ...terms, aToB: { resource: "grain", wholePerHour: 4 } };
  expectCode(
    "changed_counter",
    await command(1, { kind: "game.supply.counter", offerId, expectedVersion: 1, terms: changed }),
    "COMMITTED",
  );
  expectCode(
    "stale_signature_rejected",
    await command(0, { kind: "game.supply.sign", offerId, version: 1 }),
    "STALE_VERSION",
  );
  expectCode(
    "new_version_first_signature",
    await command(0, { kind: "game.supply.sign", offerId, version: 2 }),
    "COMMITTED",
  );
  const current = await clients[1].http("/v1/mandate");
  await clients[1].http("/v1/mandate", {
    allowedActions: ["world.read", "inbox.read"],
    resourceLimits: { iron: "0", silver: "0", grain: "0" },
    reserveFloors: { grain: "12000" },
    troopLimit: 0,
    sessionLimit: 1,
    expectedVersion: current.version,
  });
  const sign = { kind: "game.supply.sign", offerId, version: 2 };
  const denial = await command(1, sign);
  if (!["FORBIDDEN", "INSUFFICIENT_ALLOWANCE", "APPROVAL_REQUIRED"].includes(denial.code))
    throw Error(`OWNER_EXPECTED_DENIAL_${denial.code}`);
  checks.push({ name: "restricted_agent_cannot_approve", code: denial.code });
  let guide = await sessions[1].call("pact_agent_guide_v1");
  const ownerReceipt = await approveOwnerAction({
    actor: b,
    action: sign,
    commandId: denial.commandId,
    client: clients[1],
    mcp: sessions[1],
    guide,
    cohort: new Set([a.kingdomId, b.kingdomId]),
    config,
    save,
    emit,
    active,
  });
  expectCode("bounded_owner_exact_supply_signature", ownerReceipt, "COMMITTED");
  const replayed = await sessions[1].call("pact_receipt_read_v1", { commandId: denial.commandId });
  expectCode("owner_receipt_recovery_same_id", replayed, "COMMITTED");
  guide = await sessions[1].call("pact_agent_guide_v1");
  if (guide.activeSupplyContracts.length !== 1 || guide.openSupplyOffers.some((o) => o.id === offerId))
    throw Error("CONTRACT_NOT_ACTIVE");
  checks.push({ name: "both_signatures_activate_counter_version", code: "ACTIVE" });
  for (let i = 0; i < 4; i++)
    expectCode(
      `unread_message_${i + 1}`,
      await command(0, {
        kind: "game.message.send",
        recipientKingdomId: b.kingdomId,
        body: `[Local verification] negotiation observation ${i + 1}`,
      }),
      "COMMITTED",
    );
  const full = expectCode(
    "unread_queue_rejected",
    await command(0, {
      kind: "game.message.send",
      recipientKingdomId: b.kingdomId,
      body: "[Local verification] queue bound",
    }),
    "MESSAGE_QUEUE_FULL",
  );
  const ga = await sessions[0].call("pact_agent_guide_v1");
  recordOutcome(a, { kind: "game.message.send", recipientKingdomId: b.kingdomId }, full.code, ga.asOfGameTimeMs);
  save();
  if (actionAvailable({ kind: "game.message.send", recipientKingdomId: b.kingdomId }, pacedGuide(a, ga)))
    throw Error("BACKOFF_NOT_APPLIED");
  checks.push({ name: "queue_backoff_blocks_repeat_without_dispatch", code: "LOCAL_BACKOFF" });
  await sessions[1].call("pact_conversation_read_v1", { counterpartyKingdomId: a.kingdomId, limit: 3 });
  expectCode(
    "read_acknowledgment_frees_queue",
    await command(0, {
      kind: "game.message.send",
      recipientKingdomId: b.kingdomId,
      body: "[Local verification] read acknowledgment frees one slot",
    }),
    "COMMITTED",
  );
  const build = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
  const buildDenied = await command(1, build);
  guide = await sessions[1].call("pact_agent_guide_v1");
  const built = await approveOwnerAction({
    actor: b,
    action: build,
    commandId: buildDenied.commandId,
    client: clients[1],
    mcp: sessions[1],
    guide,
    cohort: new Set([a.kingdomId, b.kingdomId]),
    config,
    save,
    emit,
    active,
  });
  expectCode("bounded_owner_proposal_build_approval", built, "COMMITTED");
  let blocked = false;
  try {
    validateAction(
      { kind: "game.building.queue", building: "hall", targetLevel: 2, slot: 2 },
      ga,
      new Set([a.kingdomId, b.kingdomId]),
    );
  } catch (e) {
    blocked = e.message === "BUILD_NO_LONGER_AVAILABLE";
  }
  if (!blocked) throw Error("PREREQUISITE_GUARD_MISSING");
  checks.push({ name: "missing_hall_prerequisite_excluded", code: "BUILD_NO_LONGER_AVAILABLE" });
  const unchanged = await clients[1].http("/v1/mandate");
  if (unchanged.allowedActions.includes("supply.sign") || unchanged.allowedActions.includes("building.queue"))
    throw Error("MANDATE_WIDENED");
  checks.push({ name: "owner_exceptions_do_not_widen_mandate", code: "UNCHANGED" });
  state.status = "finished";
  save();
  const proof = {
    observedAt: new Date().toISOString(),
    modelRequests: 0,
    dispatches,
    actors: state.actors.map(({ index, kingdomId }) => ({ index, kingdomId })),
    checks,
    offerId,
    ownerDecisions: Object.keys(b.ownerDecisions ?? {}).length,
    pending: state.actors.filter((a) => a.pending).length,
    note: "New isolated synthetic owners; normal public invitations, mandates, commands and exact-owner approvals. No budget reset, direct database mutation, free resources or model inference. Contract settlement and building completion continue under normal ticks.",
  };
  atomicJson(path.join(dir, "probe.json"), proof);
  console.log(JSON.stringify(proof));
} catch (e) {
  state.status = "failed";
  save();
  throw e;
} finally {
  for (const mcp of sessions) await mcp.close();
  store.close();
}
