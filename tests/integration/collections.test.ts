import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { CourtCommandSchema } from "@pact/contracts";
import {
  appendOutbox,
  createPool,
  createSchemaPool,
  createTestSchema,
  dropTestSchema,
  migrate,
  withTransaction,
} from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  CollectionService,
  CollectionStoriesService,
  ConversationReader,
  CourtService,
  recordCollectionIncident,
  SocialOverviewReader,
  SocialService,
  SupplyService,
  SupplySettlementService,
  type SupplyTerms,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string;
const ledger = new ResourceLedger("pact"),
  limits = new ActionLimitService("pact"),
  clock = { now: () => new Date() },
  collections = new CollectionService("pact");
let social: SocialService, supply: SupplyService;
const settlement = new SupplySettlementService("pact", ledger, { read: async () => 0n });
beforeEach(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "collection");
  pool = createSchemaPool(url, schema);
  await new WorldClockService(pool, "pact").bootstrap();
  social = new SocialService("pact", ledger, limits, clock);
  supply = new SupplyService("pact", ledger, limits, social, {
    reserve: async () => {
      throw Error("HUMAN_FIXTURE_NO_AGENT_RESERVATION");
    },
    release: async () => {},
    activate: async () => {},
  });
});

describe("offline collection exploit and load acceptance", () => {
  const emit = (values: Record<string, unknown>) =>
    console.log(
      `COLLECTION_OBSERVATION ${JSON.stringify({ case: "unknown", source: "synthetic_postgres_fixture", attempts: 0, rawMessages: 0, pieces: 0, instances: 0, setCompletions: 0, contractActivations: 0, changedDeliveringTerms: 0, positiveBilateralTicks: 0, repeatedGrants: 0, newGems: 0, quarantinedEvents: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, gpuGenerationMs: 0, p95ReadMs: null, ...values })}`,
    );
  it("raw message/approval and canceled-raid floods cannot duplicate pieces or grant currency/instances", async () => {
    const a = await player(),
      b = await player();
    await contact(a, b);
    for (let i = 0; i < 12; i++)
      await withTransaction(pool, (c) =>
        social.sendMessage(c, {
          accountId: i % 2 ? a.accountId : b.accountId,
          recipientKingdomId: i % 2 ? b.kingdomId : a.kingdomId,
          body: `Synthetic repeated statement ${i}`,
          agentOriginated: true,
          gameTimeMs: 1000 + i,
          operationKey: randomUUID(),
        }),
      );
    for (let i = 0; i < 100; i++)
      await event(i % 2 ? "approval.accepted.v1" : "agent.message.claimed.v1", {
        accountId: a.accountId,
        count: 100000,
      });
    const raidId = randomUUID();
    await pool.query(
      "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,status,loot_priority,declaration_terms) VALUES($1,'pact',$2,$3,'pact-s1-v1',0,60000,120000,'canceled',ARRAY['silver','iron','grain'],'{}')",
      [raidId, a.kingdomId, b.kingdomId],
    );
    await event("raid.resolved.v1", { raidId });
    await project();
    expect(await owned(a)).toEqual([]);
    const reader = new ConversationReader(pool, "pact");
    for (let i = 0; i < 2; i++) {
      await reader.read(a.accountId, b.kingdomId);
      await reader.read(b.accountId, a.kingdomId);
      await project();
    }
    const service = new CollectionStoriesService(pool, "pact"),
      view = await service.read(a.accountId);
    expect(await owned(a)).toEqual(["opened_channel"]);
    expect(view.instances).toHaveLength(0);
    expect(view.incidents).toHaveLength(1);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM cosmetic_wallet_entries WHERE account_id=$1", [a.accountId]))
        .rows[0].n,
    ).toBe(0);
    emit({ case: "raw-flood-and-canceled-raid", attempts: 113, rawMessages: 12, pieces: 1 });
  });
  it("quarantines poisoned retained raid evidence and continues later valid season work", async () => {
    const a = await player(),
      b = await player(),
      raidId = randomUUID();
    await pool.query(
      "INSERT INTO raids(id,product_scope,leader_kingdom_id,target_kingdom_id,rules_version,declared_game_time_ms,lock_game_time_ms,resolution_game_time_ms,status,loot_priority,declaration_terms,resolved_game_time_ms,participant_report) VALUES($1,'pact',$2,$3,'pact-s1-v1',0,60000,120000,'resolved',ARRAY['silver','iron','grain'],'{}',120000,'{}')",
      [raidId, a.kingdomId, b.kingdomId],
    );
    await event("raid.resolved.v1", { raidId });
    await pool.query(
      "INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) VALUES('pact',$1,'banner.season.2','season:2:participation')",
      [a.accountId],
    );
    await event("season.participation.awarded.v2", { accountId: a.accountId, seasonNumber: 2 });
    expect((await withTransaction(pool, (c) => collections.processSafely(c, 120000))).failed).toBe(false);
    expect((await read(a)).failedEvents).toBe(1);
    expect(await owned(a)).toEqual(["through_season"]);
    await project(120000);
    expect((await read(a)).failedEvents).toBe(1);
    emit({ case: "poisoned-evidence-isolation", attempts: 2, pieces: 1, quarantinedEvents: 1 });
  });
  it("makes receipt failure atomic and retains an explicit unavailable count after story sources expire", async () => {
    const a = await player(),
      eventId = randomUUID(),
      service = new CollectionStoriesService(pool, "pact");
    await withTransaction(pool, (c) =>
      recordCollectionIncident(
        c,
        "pact",
        a.accountId,
        eventId,
        "battle",
        "battle",
        null,
        60000,
        { ownOrdinaryLosses: 1 },
        true,
      ),
    );
    const v = await service.read(a.accountId);
    await service.command(a.accountId, {
      schemaVersion: "pact.collection-command.v2",
      kind: "story",
      commandId: randomUUID(),
      storyId: randomUUID(),
      expectedVersion: 0,
      title: "Private synthetic interpretation",
      annotation: "Current note",
      incidentIds: [v.incidents[0].id],
      deleted: false,
    });
    await pool.query(
      "CREATE FUNCTION reject_collection_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic rollback'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER reject_fixture BEFORE INSERT ON collection_command_receipts FOR EACH ROW EXECUTE FUNCTION reject_collection_receipt()",
    );
    await expect(
      service.command(a.accountId, {
        schemaVersion: "pact.collection-command.v2",
        kind: "display",
        commandId: randomUUID(),
        expectedVersion: 0,
        display: {
          slots: { hall: `campaign:${v.instances[0].id}`, banner: null, frame: null, stamp: null },
          goals: [],
          publicCard: { enabled: false, title: "", slots: [] },
        },
      }),
    ).rejects.toThrow("synthetic rollback");
    expect((await service.read(a.accountId)).displayVersion).toBe(0);
    await pool.query("DROP TRIGGER reject_fixture ON collection_command_receipts");
    await withTransaction(pool, (c) => service.retention.prune(c, new Date("2027-05-01")));
    const after = await service.read(a.accountId);
    expect(after.stories[0].unavailableIncidentCount).toBe(1);
    expect(after.stories[0].incidentIds).toEqual([]);
    expect(after.instances[0].incidentId).toBeNull();
    emit({ case: "rollback-and-source-retention", attempts: 2, instances: 1 });
  });
  it("paginates 55 owned incidents/instances without duplicates and enforces one kingdom per account", async () => {
    const a = await player(),
      foreign = await player(),
      service = new CollectionStoriesService(pool, "pact");
    await expect(
      pool.query(
        `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,
        activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id)
        SELECT $1,product_scope,account_id,$3,'Known same owner fixture',portrait,activated_at,
        activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,$1 FROM kingdoms WHERE account_id=$2`,
        [randomUUID(), a.accountId, `same_${randomUUID().slice(0, 8)}`],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await withTransaction(pool, async (c) => {
      for (let i = 0; i < 55; i++)
        await recordCollectionIncident(
          c,
          "pact",
          a.accountId,
          randomUUID(),
          "load-fixture",
          "battle",
          null,
          60000 + i,
          { classification: "synthetic_fixture" },
          true,
        );
    });
    const latencies = [];
    let cursor: string | null = null;
    const incidents = new Set<string>(),
      instances = new Set<string>();
    do {
      const start = performance.now(),
        page = await service.read(a.accountId, cursor ? { beforeIncidentId: cursor } : {});
      latencies.push(performance.now() - start);
      for (const i of page.incidents) {
        expect(incidents.has(i.id)).toBe(false);
        incidents.add(i.id);
      }
      cursor = page.nextIncidentId;
    } while (cursor);
    do {
      const page = await service.read(a.accountId, cursor ? { beforeInstanceId: cursor } : {});
      for (const i of page.instances) {
        expect(instances.has(i.id)).toBe(false);
        instances.add(i.id);
      }
      cursor = page.nextInstanceId;
    } while (cursor);
    expect(incidents.size).toBe(55);
    expect(instances.size).toBe(55);
    expect((await service.read(foreign.accountId)).incidents).toEqual([]);
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await service.read(a.accountId);
      latencies.push(performance.now() - start);
    }
    latencies.sort((a, b) => a - b);
    emit({
      case: "55-source-pagination-fixture",
      attempts: 55,
      instances: 55,
      p95ReadMs: Number(latencies[Math.ceil(latencies.length * 0.95) - 1]?.toFixed(3)),
    });
  });
  it("allows deletion at the active-card limit but cannot restore a fifty-first card", async () => {
    const a = await player(),
      service = new CollectionStoriesService(pool, "pact");
    const existing = (
      await pool.query(
        "INSERT INTO collection_stories(product_scope,account_id,id,version,title,annotation) SELECT 'pact',$1,gen_random_uuid(),1,'Synthetic bounded card','' FROM generate_series(1,50) RETURNING id",
        [a.accountId],
      )
    ).rows[0].id;
    const deleted = randomUUID();
    await pool.query(
      "INSERT INTO collection_stories(product_scope,account_id,id,version,title,annotation,deleted) VALUES('pact',$1,$2,1,'','',true)",
      [a.accountId, deleted],
    );
    const command = {
      schemaVersion: "pact.collection-command.v2" as const,
      kind: "story" as const,
      commandId: randomUUID(),
      storyId: deleted,
      expectedVersion: 1,
      title: "Restored",
      annotation: "",
      incidentIds: [],
      deleted: false,
    };
    await expect(service.command(a.accountId, command)).rejects.toMatchObject({ code: "STORY_LIMIT" });
    await service.command(a.accountId, { ...command, commandId: randomUUID(), storyId: existing, deleted: true });
    await service.command(a.accountId, command);
    expect((await service.read(a.accountId)).stories).toHaveLength(50);
  });
});

describe("private collection equipment and story commands", () => {
  const display = {
    slots: { hall: "ornament.margin_notes", banner: null, frame: null, stamp: null },
    goals: ["terms_changed"],
    publicCard: { enabled: false, title: "", slots: [] },
  };
  const command = (expectedVersion = 0) => ({
    schemaVersion: "pact.collection-command.v2",
    kind: "display",
    commandId: randomUUID(),
    expectedVersion,
    display,
  });
  it("serializes devices, replays exact receipts and never equips foreign or incompatible items", async () => {
    const a = await player(),
      b = await player();
    await agreement(a, b);
    await project();
    const service = new CollectionStoriesService(pool, "pact"),
      save = command();
    const balances = (
      await pool.query("SELECT to_jsonb(b) AS value FROM resource_balances b ORDER BY kingdom_id,resource")
    ).rows;
    expect((await service.command(a.accountId, save)).code).toBe("COMMITTED");
    expect((await new CollectionStoriesService(pool, "pact").command(a.accountId, save)).code).toBe(
      "ALREADY_COMMITTED",
    );
    await expect(service.command(a.accountId, { ...save, display: { ...display, goals: [] } })).rejects.toMatchObject({
      code: "OPERATION_CONFLICT",
    });
    const results = await Promise.allSettled([
      service.command(a.accountId, command(1)),
      service.command(a.accountId, command(1)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.read(a.accountId)).displayVersion).toBe(2);
    await expect(
      service.command(a.accountId, {
        ...command(2),
        display: { ...display, slots: { ...display.slots, hall: "ornament.not_owned" } },
      }),
    ).rejects.toMatchObject({ code: "NOT_OWNED" });
    await expect(
      service.command(a.accountId, {
        ...command(2),
        display: { ...display, slots: { ...display.slots, banner: "ornament.margin_notes" } },
      }),
    ).rejects.toMatchObject({ code: "INCOMPATIBLE_SLOT" });
    expect(
      (await pool.query("SELECT to_jsonb(b) AS value FROM resource_balances b ORDER BY kingdom_id,resource")).rows,
    ).toEqual(balances);
    expect((await service.read(a.accountId)).displayVersion).toBe(2);
  });
  it("creates private interpretation cards only from owned incidents and explicitly sanitized public displays", async () => {
    const a = await player(),
      b = await player(),
      foreign = await player();
    await agreement(a, b);
    await project();
    const service = new CollectionStoriesService(pool, "pact");
    const view = await service.read(a.accountId),
      incident = view.incidents[0];
    expect(incident).toBeTruthy();
    const story = {
      schemaVersion: "pact.collection-command.v2",
      kind: "story",
      commandId: randomUUID(),
      storyId: randomUUID(),
      expectedVersion: 0,
      title: "My interpretation",
      annotation: "Private synthetic observation",
      incidentIds: [incident.id],
      deleted: false,
    };
    await expect(service.command(foreign.accountId, story)).rejects.toMatchObject({ code: "NOT_OWNED" });
    await service.command(a.accountId, story);
    expect((await service.read(foreign.accountId)).stories).toEqual([]);
    const handle = (await pool.query("SELECT handle FROM kingdoms WHERE id=$1", [a.kingdomId])).rows[0].handle;
    expect(await service.publicCard(handle)).toBeNull();
    await service.command(a.accountId, {
      ...command(),
      display: { ...display, publicCard: { enabled: true, title: "Chosen public title", slots: ["hall"] } },
    });
    const card = await service.publicCard(handle);
    expect(card).toEqual({
      title: "Chosen public title",
      items: [{ slot: "hall", itemId: "ornament.margin_notes" }],
      meaning: expect.any(String),
    });
    expect(JSON.stringify(card)).not.toMatch(/Private synthetic|incident|peer|account|contract|goal|source/);
    await service.command(a.accountId, { ...story, commandId: randomUUID(), expectedVersion: 1, deleted: true });
    expect((await service.read(a.accountId)).stories).toEqual([]);
  });
  it("keeps deterministic instances through source deletion and prunes/forgets private metadata", async () => {
    const a = await player(),
      service = new CollectionStoriesService(pool, "pact"),
      event = randomUUID();
    await withTransaction(pool, async (c) => {
      await recordCollectionIncident(
        c,
        "pact",
        a.accountId,
        event,
        "battle",
        "battle",
        null,
        60000,
        { ownOrdinaryLosses: 1 },
        true,
      );
      await recordCollectionIncident(
        c,
        "pact",
        a.accountId,
        event,
        "battle",
        "battle",
        null,
        60000,
        { ownOrdinaryLosses: 999 },
        true,
      );
    });
    const view = await service.read(a.accountId);
    expect(view.instances).toHaveLength(1);
    expect(view.incidents[0].facts.ownOrdinaryLosses).toBe(1);
    await service.command(a.accountId, {
      ...command(),
      display: { ...display, slots: { ...display.slots, hall: `campaign:${view.instances[0].id}` } },
    });
    await withTransaction(pool, (c) => service.retention.prune(c, new Date("2027-05-01")));
    const after = await service.read(a.accountId);
    expect(after.incidents).toEqual([]);
    expect(after.instances[0].incidentId).toBeNull();
    expect(after.instances[0].pattern).toBe(view.instances[0].pattern);
    expect(
      JSON.stringify(await withTransaction(pool, (c) => service.retention.exportAccount(c, a.accountId))),
    ).not.toContain("Retained synthetic body");
    await withTransaction(pool, (c) => service.retention.forgetAccount(c, a.accountId));
    expect((await service.read(a.accountId)).instances).toEqual([]);
  });
});
afterEach(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
type Player = { accountId: string; kingdomId: string };
async function player(): Promise<Player> {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await withTransaction(pool, async (c) => {
    await c.query(
      "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')",
      [accountId, `${accountId}@example.test`],
    );
    await c.query(
      "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Synthetic collection','portrait.wolf',clock_timestamp(),0,0,60000,$4)",
      [kingdomId, accountId, `col_${accountId.slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(c, kingdomId, 0);
    for (const resource of ["grain", "iron", "silver"] as const)
      await ledger.creditOrdinary(c, {
        kingdomId,
        resource,
        amount: wholeResources(100),
        operationKey: randomUUID(),
        reason: "synthetic fixture",
        gameTimeMs: 0,
      });
  });
  return { accountId, kingdomId };
}
async function contact(a: Player, b: Player) {
  const pair = [a.kingdomId, b.kingdomId].sort();
  await pool.query(
    "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0) ON CONFLICT DO NOTHING",
    pair,
  );
}
const project = async (at = 60000, limit = 500) =>
  withTransaction(pool, (c) => collections.processPending(c, at, limit));
const read = async (p: Player) => withTransaction(pool, (c) => collections.read(c, p.accountId));
const owned = async (p: Player) => (await read(p)).pieces.filter((x) => x.owned).map((x) => x.id);
async function event(type: string, payload: unknown) {
  const id = randomUUID();
  await withTransaction(pool, (c) => appendOutbox(c, { productScope: "pact", eventId: id, type, payload }));
  return id;
}
async function agreement(
  a: Player,
  b: Player,
  counter = true,
  start = 0,
  resources: ["grain" | "iron" | "silver", "grain" | "iron" | "silver"] = ["grain", "iron"],
) {
  await contact(a, b);
  const offerId = randomUUID();
  const terms: SupplyTerms = {
    aToB: { resource: resources[0], wholePerHour: 3 },
    bToA: { resource: resources[1], wholePerHour: 3 },
    aBond: null,
    bBond: null,
    durationHours: 6,
    noticeHours: 0,
  };
  await withTransaction(pool, (c) =>
    supply.createOffer(c, {
      accountId: a.accountId,
      offerId,
      counterpartyKingdomId: b.kingdomId,
      terms,
      gameTimeMs: start,
      operationKey: randomUUID(),
    }),
  );
  let version = 1;
  if (counter)
    version = await withTransaction(pool, (c) =>
      supply.counterOffer(c, {
        accountId: b.accountId,
        offerId,
        expectedVersion: 1,
        terms: { ...terms, aToB: { resource: resources[0], wholePerHour: 2 } },
        gameTimeMs: start,
        operationKey: randomUUID(),
      }),
    );
  await withTransaction(pool, (c) =>
    supply.signOffer(c, {
      accountId: a.accountId,
      offerId,
      version,
      actorKind: "human",
      gameTimeMs: start,
      operationKey: randomUUID(),
    }),
  );
  const signed = await withTransaction(pool, (c) =>
    supply.signOffer(c, {
      accountId: b.accountId,
      offerId,
      version,
      actorKind: "human",
      gameTimeMs: start,
      operationKey: randomUUID(),
    }),
  );
  if (!signed.contractId) throw Error("CONTRACT_NOT_ACTIVATED");
  const at = start + 60000;
  await withTransaction(pool, async (c) => {
    await settlement.capture(c, at);
    await settlement.settleDeliveries(c, at);
    await settlement.settleDefaults(c, at);
  });
  return { id: signed.contractId, offerId, at };
}
describe("trusted collection outcome projection", () => {
  it("awards reciprocal channel only from participant-delivered acknowledgements and no new Gems", async () => {
    const a = await player(),
      b = await player(),
      foreign = await player();
    await contact(a, b);
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const)
      await withTransaction(pool, (c) =>
        social.sendMessage(c, {
          accountId: from.accountId,
          recipientKingdomId: to.kingdomId,
          body: "Synthetic delivered greeting",
          agentOriginated: false,
          operationKey: randomUUID(),
          gameTimeMs: 1000,
        }),
      );
    await new SocialOverviewReader(pool, "pact").read(a.accountId, { acknowledgeDeliveredMessages: false });
    await project();
    expect(await owned(a)).not.toContain("opened_channel");
    const conversations = new ConversationReader(pool, "pact");
    await conversations.read(a.accountId, b.kingdomId);
    await project();
    expect(await owned(a)).not.toContain("opened_channel");
    await conversations.read(b.accountId, a.kingdomId);
    await project();
    expect(await owned(a)).toContain("opened_channel");
    expect(await owned(b)).toContain("opened_channel");
    await conversations.read(b.accountId, a.kingdomId);
    await project();
    expect((await pool.query("SELECT count(*)::int AS n FROM achievement_awards")).rows[0]?.n).toBe(2);
    expect((await pool.query("SELECT count(*)::int AS n FROM cosmetic_wallet_entries")).rows[0]?.n).toBe(0);
    expect(await owned(foreign)).toEqual([]);
  });
  it("recognizes real changed offers, final signatures, delivery and distinct partner/resource keys", async () => {
    const a = await player(),
      b = await player(),
      c = await player(),
      d = await player();
    const first = await agreement(a, b);
    await project(first.at);
    expect(await owned(a)).toContain("terms_changed");
    expect((await read(a)).progress.partners).toBe(1);
    await event("supply.full_both_delivered.v1", { contractId: first.id, gameTimeMs: first.at });
    await project(first.at);
    expect((await read(a)).progress.partners).toBe(1);
    const second = await agreement(a, c, false, 120000, ["iron", "silver"]);
    await project(second.at);
    const third = await agreement(a, d, false, 240000);
    await project(third.at);
    expect(await owned(a)).toEqual(
      expect.arrayContaining(["terms_changed", "three_trading_partners", "three_resources_exchanged"]),
    );
    expect((await pool.query("SELECT count(*)::int AS n FROM cosmetic_wallet_entries")).rows[0]?.n).toBe(0);
  });
  it("rejects missing initial history, unmatched signatures and overflow/partial ticks", async () => {
    const a = await player(),
      b = await player();
    const contract = await agreement(a, b);
    await pool.query("UPDATE supply_offer_versions SET historical_baseline=true WHERE offer_id=$1 AND version=1", [
      contract.offerId,
    ]);
    await pool.query("UPDATE supply_installments SET overflow_units=delivered_units WHERE contract_id=$1", [
      contract.id,
    ]);
    await project(contract.at);
    expect(await owned(a)).toEqual([]);
    await pool.query(
      "UPDATE supply_installments SET overflow_units=0,delivered_units=due_units-1 WHERE contract_id=$1",
      [contract.id],
    );
    await event("supply.full_both_delivered.v1", { contractId: contract.id, gameTimeMs: contract.at });
    await project(contract.at);
    expect(await owned(a)).toEqual([]);
    await pool.query("UPDATE supply_installments SET delivered_units=due_units WHERE contract_id=$1", [contract.id]);
    await event("supply.full_both_delivered.v1", { contractId: contract.id, gameTimeMs: contract.at });
    await project(contract.at);
    expect(await owned(a)).not.toContain("terms_changed");
    expect((await read(a)).progress.partners).toBe(1);
    await pool.query("UPDATE supply_offer_versions SET historical_baseline=false WHERE offer_id=$1 AND version=1", [
      contract.offerId,
    ]);
    await pool.query("DELETE FROM supply_offer_signatures WHERE offer_id=$1 AND kingdom_id=$2", [
      contract.offerId,
      b.kingdomId,
    ]);
    await event("supply.full_both_delivered.v1", { contractId: contract.id, gameTimeMs: contract.at });
    await project(contract.at);
    expect(await owned(a)).not.toContain("terms_changed");
  });
  it("proves six-hour Court intervals through join/leave continuity, not a current-row historical guess", async () => {
    const a = await player(),
      b = await player(),
      d = await player(),
      courts = new CourtService(pool, "pact", clock);
    const execute = (p: Player, action: unknown, at: number) =>
      withTransaction(pool, (c) =>
        courts.execute(
          c,
          p.accountId,
          CourtCommandSchema.parse({ schemaVersion: "pact.court-command.v1", commandId: randomUUID(), action }),
          at,
        ),
      );
    const created = await execute(
      a,
      {
        kind: "court.create",
        handle: "collection_court",
        title: "Synthetic Court",
        description: "Fixture",
        joinMode: "open",
      },
      1000,
    );
    const id = created.result.courtId;
    await execute(b, { kind: "court.join", courtId: id }, 2000);
    await project(21601999);
    expect(await owned(a)).not.toContain("place_at_council");
    await execute(d, { kind: "court.join", courtId: id }, 3000);
    await execute(b, { kind: "court.leave", courtId: id }, 4000);
    await project(21602000);
    expect(await owned(a)).toContain("place_at_council");
    expect(await owned(b)).not.toContain("place_at_council");
    await execute(d, { kind: "court.leave", courtId: id }, 21603000);
    await execute(b, { kind: "court.join", courtId: id }, 21604000);
    await project(21605000);
    expect(await owned(b)).not.toContain("place_at_council");
    await project(43204000);
    expect(await owned(b)).toContain("place_at_council");
  });
  it("requires retained no-default natural completion and a later different delivering agreement", async () => {
    const a = await player(),
      b = await player();
    await agreement(a, b, false);
    await withTransaction(pool, (c) => settlement.settleBoundaries(c, 21660000));
    const second = await agreement(a, b, false, 21720000);
    await project(second.at);
    expect(await owned(a)).toContain("another_agreement");
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM achievement_awards WHERE achievement_id='another_agreement'"))
        .rows[0]?.n,
    ).toBe(2);
  });
  it("uses actual participation entitlements, deterministic set completion and rollback-safe consumption", async () => {
    const a = await player();
    await event("season.participation.awarded.v2", { accountId: a.accountId, seasonNumber: 1 });
    await project();
    expect(await owned(a)).not.toContain("through_season");
    await pool.query(
      "INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) VALUES('pact',$1,'banner.season.1','season:1:participation')",
      [a.accountId],
    );
    await event("season.participation.awarded.v2", { accountId: a.accountId, seasonNumber: 1 });
    await expect(
      withTransaction(pool, async (c) => {
        await collections.processPending(c, 60000);
        throw Error("FAULT_BEFORE_COMMIT");
      }),
    ).rejects.toThrow("FAULT");
    expect(await owned(a)).toEqual([]);
    await Promise.all([project(), project()]);
    expect(await owned(a)).toEqual(["through_season"]);
    for (const id of ["winter_stores", "place_at_council", "another_agreement"])
      await pool.query(
        "INSERT INTO achievement_awards(product_scope,account_id,achievement_id,source_event_id,awarded_game_time_ms) VALUES('pact',$1,$2,$3,60000)",
        [a.accountId, id, randomUUID()],
      );
    await project();
    await project();
    expect((await read(a)).sets.find((s) => s.id === "world")?.trophyOwned).toBe(true);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM cosmetic_entitlements WHERE item_id='trophy.season_hanging'"))
        .rows[0]?.n,
    ).toBe(1);
  });
  it("does not skip an earlier outbox ID whose transaction commits after a later ID", async () => {
    const c = await pool.connect();
    await c.query("BEGIN");
    const old = randomUUID();
    await appendOutbox(c, {
      productScope: "pact",
      eventId: old,
      type: "message.acknowledged.v2",
      payload: { messageId: randomUUID() },
    });
    await event("message.acknowledged.v2", { messageId: randomUUID() });
    expect(await project()).toBe(1);
    await c.query("COMMIT");
    c.release();
    expect(await project()).toBe(1);
    expect((await pool.query("SELECT count(*)::int AS n FROM collection_processed_events")).rows[0]?.n).toBe(2);
  });
  it("backfills retained acknowledgments/season entitlements but starts Court proof at deployment", async () => {
    const a = await player(),
      b = await player();
    await contact(a, b);
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const)
      await pool.query(
        "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms,read_game_time_ms) VALUES($1::uuid,'pact',$2,$3,'Retained synthetic body',false,$1::uuid::text,1000,2000)",
        [randomUUID(), from.kingdomId, to.kingdomId],
      );
    await pool.query(
      "INSERT INTO cosmetic_entitlements(product_scope,account_id,item_id,source_achievement_id) VALUES('pact',$1,'banner.season.1','season:1:participation')",
      [a.accountId],
    );
    const court = randomUUID();
    await pool.query(
      "INSERT INTO courts(id,product_scope,handle,title,owner_kingdom_id,join_mode) VALUES($1,'pact','old_court','Old synthetic Court',$2,'open')",
      [court, a.kingdomId],
    );
    for (const p of [a, b])
      await pool.query(
        "INSERT INTO court_memberships(court_id,kingdom_id,role,joined_game_time_ms) VALUES($1,$2,'member',0)",
        [court, p.kingdomId],
      );
    await pool.query("UPDATE world_clocks SET committed_game_time_ms=1000020000");
    for (const table of [
      "collection_projection_state",
      "collection_processed_events",
      "collection_award_sources",
      "collection_partner_keys",
      "collection_resource_keys",
      "collection_court_intervals",
    ])
      await pool.query(`DROP TABLE ${table}`);
    await pool.query("DELETE FROM app_migrations WHERE name='0062_collections.sql'");
    await migrate(admin, { schema });
    await project(1000020000);
    expect(await owned(a)).toEqual(expect.arrayContaining(["opened_channel", "through_season"]));
    expect(await owned(a)).not.toContain("place_at_council");
    const interval = (
      await pool.query("SELECT start_game_time_ms::text AS start FROM collection_court_intervals WHERE kingdom_id=$1", [
        a.kingdomId,
      ])
    ).rows[0];
    expect(interval.start).toBe("1000020000");
    await project(1021620000);
    expect(await owned(a)).toContain("place_at_council");
  });
  it("quarantines malformed source IDs and leaves world work usable on a projection failure", async () => {
    const a = await player();
    await withTransaction(pool, async (c) => {
      await appendOutbox(c, {
        productScope: "pact",
        eventId: randomUUID(),
        type: "message.acknowledged.v2",
        payload: { messageId: "not-a-uuid" },
      });
      const result = await collections.processSafely(c, 60000);
      expect(result.failed).toBe(false);
      expect((await collections.read(c, a.accountId)).failedEvents).toBe(1);
      await c.query("ALTER TABLE collection_award_sources RENAME TO collection_award_sources_fixture");
      expect((await collections.processSafely(c, 120000)).failed).toBe(false);
      await c.query("ALTER TABLE collection_projection_state RENAME TO collection_projection_state_fixture");
      expect((await collections.processSafely(c, 180000)).failed).toBe(true);
      expect((await c.query("SELECT 1 AS usable")).rows[0].usable).toBe(1);
    });
  });
  it("exports owned compact records, removes counterpart progress on erasure and prunes source metadata", async () => {
    const a = await player(),
      b = await player();
    await agreement(a, b);
    await project();
    expect(
      JSON.stringify(await withTransaction(pool, (c) => collections.retention.exportAccount(c, a.accountId))),
    ).not.toContain("Synthetic delivered greeting");
    await withTransaction(pool, (c) => collections.retention.forgetAccount(c, b.accountId));
    expect((await read(b)).progress.partners).toBe(0);
    await withTransaction(pool, (c) => collections.retention.prune(c, new Date("2027-05-01")));
    expect((await read(a)).pieces.find((p) => p.id === "terms_changed")?.source).toBeNull();
    expect(await owned(a)).toContain("terms_changed");
  });
});
