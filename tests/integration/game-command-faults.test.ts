import { randomUUID } from "node:crypto";
import { type AuthenticatedPrincipal, CommandDispatcher, GameCommandHandler } from "@pact/application";
import { ExactHumanPermitService, ExposureService, readReserveFloor } from "@pact/authority";
import { type CommandEnvelope, type GameAction, GameActionSchema, ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import {
  ActionLimitService,
  GarrisonService,
  ImmediateExposureAdapter,
  KingdomService,
  SocialService,
  SupplyExposureAdapter,
  SupplyService,
  SupplySettlementService,
} from "@pact/kingdom";
import { OnboardingService } from "@pact/onboarding";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const productScope = ProductScopeSchema.parse("pact");
let admin: Pool;
let pool: Pool;
let schema: string;
let dispatcher: CommandDispatcher;
let runtime: ReturnType<typeof createRulesRuntime>;
let afterHandlerFault: string | null = null;
type Owner = { accountId: string; kingdomId: string; sessionId: string };
type Scenario = { owner: Owner; action: GameAction; observe: () => Promise<void> };

beforeAll(async () => {
  admin = createPool(databaseUrl);
  schema = await createTestSchema(admin, "command_faults");
  pool = createSchemaPool(databaseUrl, schema);
  runtime = createRulesRuntime(pool, "pact", Buffer.alloc(32, 7), (size) => Buffer.alloc(size, 3));
  await runtime.world.bootstrap();
  // This matrix tests command commits, not elapsed wall-clock tick admission.
  await pool.query(`UPDATE world_clocks SET committed_game_time_ms = 1020000,
    next_tick_due_at = clock_timestamp() + interval '1 hour'`);
  const clock = { now: () => new Date() };
  const permits = new ExactHumanPermitService("pact");
  const exposure = new ExposureService("pact", permits);
  const limits = new ActionLimitService("pact");
  const social = new SocialService("pact", runtime.ledger, limits, clock, new ImmediateExposureAdapter(exposure));
  const supplyExposure = new SupplyExposureAdapter(exposure);
  const supply = new SupplyService("pact", runtime.ledger, limits, social, supplyExposure);
  const settlement = new SupplySettlementService(
    "pact",
    runtime.ledger,
    { read: (client, accountId, resource) => readReserveFloor(client, "pact", accountId, resource) },
    supplyExposure,
  );
  const kingdoms = new KingdomService(pool, {
    productScope: "pact",
    onboarding: new OnboardingService(pool, { productScope: "pact", currentTermsVersion: "terms-v1", now: clock.now }),
    world: runtime.world,
    ledger: runtime.ledger,
  });
  const handler = new GameCommandHandler(
    social,
    undefined,
    kingdoms,
    runtime.troops,
    runtime.buildings,
    permits,
    supply,
    settlement,
    exposure,
    runtime.scouting,
    new GarrisonService("pact", runtime.ledger, runtime.troops, exposure, permits),
    runtime.raids,
  );
  dispatcher = new CommandDispatcher({
    pool,
    clock,
    productScope,
    game: {
      admit: (operation) => runtime.world.admitCommand((client, snapshot) => operation(client, snapshot.gameTimeMs)),
      execute: async (client, principal, command, gameTimeMs) => {
        const mutation = await handler.execute(client, principal, command, gameTimeMs);
        if (command.commandId === afterHandlerFault) {
          expect(
            (await client.query("SELECT 1 FROM command_receipts WHERE command_id = $1", [command.commandId])).rowCount,
          ).toBe(0);
          throw new Error("FAULT_AFTER_HANDLER");
        }
        return mutation;
      },
    },
  });
  // Test-only deferred trigger fails at COMMIT, after the handler AND receipt
  // insertion. No fault hook, table, or trigger is shipped in application code.
  await pool.query(`
    CREATE TABLE command_fault_control (command_id uuid PRIMARY KEY);
    CREATE FUNCTION fail_command_commit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM command_fault_control WHERE command_id = NEW.command_id) THEN
        IF NOT EXISTS (SELECT 1 FROM command_receipts WHERE command_id = NEW.command_id AND code = 'COMMITTED') THEN
          RAISE EXCEPTION 'FAULT_RECEIPT_NOT_VISIBLE';
        END IF;
        RAISE EXCEPTION 'FAULT_AFTER_RECEIPT';
      END IF;
      RETURN NEW;
    END $$;
    CREATE CONSTRAINT TRIGGER command_commit_fault AFTER INSERT ON command_receipts
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_command_commit();
  `);
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

function principal(owner: Owner): AuthenticatedPrincipal {
  return { accountId: owner.accountId, productScope, audience: "human", sessionId: owner.sessionId };
}
function envelope(owner: Owner, action: GameAction): CommandEnvelope {
  return {
    schemaVersion: "pact.command.v1",
    commandId: randomUUID(),
    action,
    actor: {
      principalId: owner.accountId,
      productScope,
      audience: "human",
      subject: { type: "account", id: owner.accountId },
    },
    submittedAt: new Date().toISOString(),
  };
}
async function commit(owner: Owner, action: GameAction) {
  const command = envelope(owner, action);
  const receipt = await dispatcher.dispatch(principal(owner), command);
  expect(receipt.code).toBe("COMMITTED");
  return { commandId: command.commandId, receipt };
}
function recordId(versions: Record<string, number>, prefix: string): string {
  const key = Object.keys(versions).find((name) => name.startsWith(`${prefix}:`));
  if (!key) throw new Error(`Missing ${prefix} in receipt`);
  return key.slice(prefix.length + 1);
}

async function kingdom(): Promise<Owner> {
  const owner = { accountId: randomUUID(), kingdomId: randomUUID(), sessionId: randomUUID() };
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
      VALUES ($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')`,
      [owner.accountId, `${owner.accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO sessions(id,product_scope,account_id,audience,token_hash,expires_at,idle_expires_at)
      VALUES ($1,'pact',$2,'human',$3,clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 hour')`,
      [owner.sessionId, owner.accountId, randomUUID()],
    );
    await client.query(
      `INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,
      activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id)
      VALUES ($1,'pact',$2,$3,'Fault Fixture','portrait.wolf',clock_timestamp(),0,0,60000,$4)`,
      [owner.kingdomId, owner.accountId, `fault_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await runtime.ledger.initializeKingdom(client, owner.kingdomId, 0);
    // Founded roster, unlocked Hall III, and ordinary funds are synthetic setup;
    // command prerequisites below are otherwise admitted through the dispatcher.
    for (const kind of ["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"])
      await client.query("INSERT INTO kingdom_buildings VALUES ('pact',$1,$2,$3)", [
        owner.kingdomId,
        kind,
        kind === "hall" ? 3 : 1,
      ]);
    for (const [kind, capacity] of [
      ["raid", 3],
      ["scout", 4],
    ] as const)
      await client.query(
        `INSERT INTO kingdom_charges(product_scope,kingdom_id,kind,available,capacity,last_regenerated_game_time_ms)
        VALUES ('pact',$1,$2,$3,$3,0)`,
        [owner.kingdomId, kind, capacity],
      );
    for (let i = 0; i < 18; i++)
      await client.query(
        `INSERT INTO kingdom_troops(id,product_scope,owner_kingdom_id,host_kingdom_id,type,
        home_guard,placement,created_game_time_ms,created_at) VALUES ($1,'pact',$2,$2,'spearman',$3,'home',0,clock_timestamp())`,
        [randomUUID(), owner.kingdomId, i < 8],
      );
    for (const resource of ["iron", "silver", "grain"] as const)
      await runtime.ledger.creditOrdinary(client, {
        kingdomId: owner.kingdomId,
        resource,
        amount: 300_000n,
        operationKey: `fixture:${owner.kingdomId}:${resource}`,
        reason: "synthetic-test",
        gameTimeMs: 0,
      });
  });
  return owner;
}

const supplyTerms = {
  aToB: { resource: "grain" as const, wholePerHour: 1 },
  bToA: { resource: "silver" as const, wholePerHour: 1 },
  aBond: { resource: "grain" as const, wholeAmount: 1 },
  bBond: { resource: "silver" as const, wholeAmount: 1 },
  durationHours: 6 as const,
  noticeHours: 1 as const,
};
const garrisonTerms = {
  units: [{ type: "spearman" as const, count: 2 }],
  durationHours: 1 as const,
  lenderBond: { resource: "iron" as const, wholeAmount: 1 },
  hostBond: { resource: "silver" as const, wholeAmount: 1 },
};
const raidUnits = [{ type: "spearman" as const, count: 8 }];
async function contact(a: Owner, b: Owner) {
  const request = await commit(a, {
    kind: "game.contact.request",
    recipientKingdomId: b.kingdomId,
    note: "Synthetic contact",
  });
  const requestId = recordId(request.receipt.recordVersions, "contact-request");
  await commit(b, { kind: "game.contact.answer", requestId, accept: true });
}
async function supplyOffer(a: Owner, b: Owner) {
  await contact(a, b);
  return (await commit(a, { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms: supplyTerms }))
    .commandId;
}
async function supplyContract(a: Owner, b: Owner) {
  const offerId = await supplyOffer(a, b);
  await commit(a, { kind: "game.supply.sign", offerId, version: 1 });
  const signed = await commit(b, { kind: "game.supply.sign", offerId, version: 1 });
  return recordId(signed.receipt.recordVersions, "supply-contract");
}
async function garrisonOffer(a: Owner, b: Owner) {
  return (await commit(a, { kind: "game.garrison.offer", hostKingdomId: b.kingdomId, terms: garrisonTerms })).commandId;
}
async function garrisonContract(a: Owner, b: Owner) {
  const offerId = await garrisonOffer(a, b);
  await commit(a, { kind: "game.garrison.sign", offerId, version: 1 });
  const signed = await commit(b, { kind: "game.garrison.sign", offerId, version: 1 });
  return recordId(signed.receipt.recordVersions, "garrison-contract");
}

async function row(table: string, id: string) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Unsafe fixture identifier");
  return (await pool.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])).rows[0];
}
async function prepare(kind: GameAction["kind"], a: Owner, b: Owner, c: Owner): Promise<Scenario> {
  switch (kind) {
    case "game.contact.request":
      return {
        owner: a,
        action: { kind, recipientKingdomId: b.kingdomId, note: "Fault matrix" },
        observe: async () => {
          expect(
            (
              await pool.query(
                "SELECT status FROM cold_contact_requests WHERE sender_kingdom_id=$1 AND recipient_kingdom_id=$2",
                [a.kingdomId, b.kingdomId],
              )
            ).rows,
          ).toEqual([{ status: "pending" }]);
        },
      };
    case "game.contact.answer": {
      const sent = await commit(a, {
        kind: "game.contact.request",
        recipientKingdomId: b.kingdomId,
        note: "Fault matrix",
      });
      const requestId = recordId(sent.receipt.recordVersions, "contact-request");
      return {
        owner: b,
        action: { kind, requestId, accept: true },
        observe: async () => {
          expect((await row("cold_contact_requests", requestId)).status).toBe("accepted");
        },
      };
    }
    case "game.message.send":
    case "game.transfer": {
      await contact(a, b);
      return {
        owner: a,
        action:
          kind === "game.message.send"
            ? { kind, recipientKingdomId: b.kingdomId, body: "Synthetic message" }
            : { kind, recipientKingdomId: b.kingdomId, resource: "iron", wholeAmount: 3 },
        observe: async () => {
          const table = kind === "game.message.send" ? "direct_messages" : "direct_transfers";
          expect((await pool.query(`SELECT 1 FROM ${table} WHERE sender_kingdom_id=$1`, [a.kingdomId])).rowCount).toBe(
            1,
          );
        },
      };
    }
    case "game.training.queue":
      return {
        owner: a,
        action: { kind, type: "spearman", count: 1 },
        observe: async () => {
          expect(
            (await pool.query("SELECT status,requested_count FROM training_batches WHERE kingdom_id=$1", [a.kingdomId]))
              .rows,
          ).toEqual([{ status: "active", requested_count: 1 }]);
        },
      };
    case "game.training.cancel": {
      const batchId = (await commit(a, { kind: "game.training.queue", type: "spearman", count: 1 })).commandId;
      return {
        owner: a,
        action: { kind, batchId },
        observe: async () => {
          expect((await row("training_batches", batchId)).status).toBe("canceled");
        },
      };
    }
    case "game.troop.disband": {
      const troopId = (
        await pool.query(
          "SELECT id FROM kingdom_troops WHERE owner_kingdom_id=$1 AND NOT home_guard ORDER BY id LIMIT 1",
          [a.kingdomId],
        )
      ).rows[0].id as string;
      return {
        owner: a,
        action: { kind, troopId },
        observe: async () => {
          expect(await row("kingdom_troops", troopId)).toBeUndefined();
        },
      };
    }
    case "game.building.queue":
      return {
        owner: a,
        action: { kind, building: "farm", targetLevel: 2, slot: 1 },
        observe: async () => {
          expect(
            (await pool.query("SELECT state FROM building_instructions WHERE kingdom_id=$1", [a.kingdomId])).rows,
          ).toEqual([{ state: "active" }]);
        },
      };
    case "game.building.cancel": {
      const instructionId = (
        await commit(a, { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 })
      ).commandId;
      return {
        owner: a,
        action: { kind, instructionId },
        observe: async () => {
          expect((await row("building_instructions", instructionId)).state).toBe("canceled");
        },
      };
    }
    case "game.supply.offer": {
      await contact(a, b);
      return {
        owner: a,
        action: { kind, counterpartyKingdomId: b.kingdomId, terms: supplyTerms },
        observe: async () => {
          expect(
            (await pool.query("SELECT status,version FROM supply_offers WHERE kingdom_a=$1", [a.kingdomId])).rows,
          ).toEqual([{ status: "open", version: 1 }]);
        },
      };
    }
    case "game.supply.counter":
    case "game.supply.sign":
    case "game.supply.withdraw": {
      const offerId = await supplyOffer(a, b);
      if (kind === "game.supply.sign") await commit(a, { kind, offerId, version: 1 });
      const action: GameAction =
        kind === "game.supply.counter"
          ? { kind, offerId, expectedVersion: 1, terms: { ...supplyTerms, noticeHours: 0 } }
          : kind === "game.supply.sign"
            ? { kind, offerId, version: 1 }
            : { kind, offerId };
      return {
        owner: kind === "game.supply.withdraw" ? a : b,
        action,
        observe: async () => {
          expect(await row("supply_offers", offerId)).toMatchObject(
            kind === "game.supply.counter"
              ? { status: "open", version: 2 }
              : { status: kind === "game.supply.sign" ? "active" : "withdrawn" },
          );
          if (kind === "game.supply.sign")
            expect((await pool.query("SELECT status FROM supply_contracts WHERE offer_id=$1", [offerId])).rows).toEqual(
              [{ status: "active" }],
            );
        },
      };
    }
    case "game.supply.notice":
    case "game.supply.refuse":
    case "game.supply.release": {
      const contractId = await supplyContract(a, b);
      if (kind === "game.supply.release") await commit(a, { kind, contractId });
      return {
        owner: kind === "game.supply.release" ? b : a,
        action: { kind, contractId },
        observe: async () => {
          if (kind === "game.supply.release")
            expect(
              (await pool.query("SELECT 1 FROM supply_release_signatures WHERE contract_id=$1", [contractId])).rowCount,
            ).toBe(2);
          else if (kind === "game.supply.notice")
            expect(BigInt((await row("supply_contracts", contractId)).notice_end_game_time_ms)).toBeGreaterThan(0n);
          else
            expect(
              (await pool.query("SELECT kingdom_id FROM supply_refusals WHERE contract_id=$1", [contractId])).rows,
            ).toEqual([{ kingdom_id: a.kingdomId }]);
        },
      };
    }
    case "game.scout.start":
      return {
        owner: a,
        action: { kind, targetKingdomId: b.kingdomId },
        observe: async () => {
          expect(
            (
              await pool.query("SELECT 1 FROM kingdom_troops WHERE owner_kingdom_id=$1 AND placement='scouting'", [
                a.kingdomId,
              ])
            ).rowCount,
          ).toBe(2);
        },
      };
    case "game.scout.share": {
      const operationId = (await commit(a, { kind: "game.scout.start", targetKingdomId: b.kingdomId })).commandId;
      const due = Number((await row("scout_operations", operationId)).due_game_time_ms);
      await withTransaction(pool, (client) => runtime.scouting.finishDue(client, due));
      // Set up a completed report at the same synthetic game time as its share.
      // Full minute ordering and upkeep are exercised by rules-runtime.test.ts.
      await pool.query("UPDATE world_clocks SET committed_game_time_ms=$1", [due]);
      return {
        owner: a,
        action: { kind, operationId, recipientKingdomId: c.kingdomId },
        observe: async () => {
          expect(
            (
              await pool.query("SELECT recipient_kingdom_id FROM scout_report_shares WHERE operation_id=$1", [
                operationId,
              ])
            ).rows,
          ).toEqual([{ recipient_kingdom_id: c.kingdomId }]);
        },
      };
    }
    case "game.garrison.offer":
      return {
        owner: a,
        action: { kind, hostKingdomId: b.kingdomId, terms: garrisonTerms },
        observe: async () => {
          expect(
            (await pool.query("SELECT status FROM garrison_offers WHERE lender_kingdom_id=$1", [a.kingdomId])).rows,
          ).toEqual([{ status: "open" }]);
        },
      };
    case "game.garrison.sign":
    case "game.garrison.withdraw": {
      const offerId = await garrisonOffer(a, b);
      if (kind === "game.garrison.sign") await commit(a, { kind, offerId, version: 1 });
      return {
        owner: kind === "game.garrison.sign" ? b : a,
        action: kind === "game.garrison.sign" ? { kind, offerId, version: 1 } : { kind, offerId },
        observe: async () => {
          expect((await row("garrison_offers", offerId)).status).toBe(
            kind === "game.garrison.sign" ? "active" : "withdrawn",
          );
          if (kind === "game.garrison.sign")
            expect(
              (
                await pool.query(
                  "SELECT 1 FROM kingdom_troops WHERE owner_kingdom_id=$1 AND host_kingdom_id=$2 AND placement='visiting'",
                  [a.kingdomId, b.kingdomId],
                )
              ).rowCount,
            ).toBe(2);
        },
      };
    }
    case "game.garrison.seize":
    case "game.garrison.exit":
    case "game.garrison.release": {
      const contractId = await garrisonContract(a, b);
      if (kind === "game.garrison.release") await commit(a, { kind, contractId });
      return {
        owner: kind === "game.garrison.exit" ? a : b,
        action: { kind, contractId },
        observe: async () => {
          expect((await row("garrison_contracts", contractId)).status).toBe("closed");
          expect(
            (
              await pool.query("SELECT 1 FROM kingdom_troops WHERE placement='visiting' AND placement_ref=$1", [
                contractId,
              ])
            ).rowCount,
          ).toBe(0);
          expect(
            (
              await pool.query("SELECT count(*)::int AS count FROM kingdom_troops WHERE owner_kingdom_id=$1", [
                b.kingdomId,
              ])
            ).rows[0].count,
          ).toBe(kind === "game.garrison.seize" ? 20 : 18);
        },
      };
    }
    case "game.raid.declare":
      return {
        owner: a,
        action: { kind, targetKingdomId: b.kingdomId, units: raidUnits },
        observe: async () => {
          expect(
            (
              await pool.query("SELECT 1 FROM kingdom_troops WHERE owner_kingdom_id=$1 AND placement='attacking'", [
                a.kingdomId,
              ])
            ).rowCount,
          ).toBe(8);
        },
      };
    case "game.raid.nominate":
    case "game.raid.accept":
    case "game.raid.withdraw": {
      const raidId = (await commit(a, { kind: "game.raid.declare", targetKingdomId: b.kingdomId, units: raidUnits }))
        .commandId;
      if (kind === "game.raid.accept")
        await commit(a, { kind: "game.raid.nominate", raidId, slot: 1, kingdomId: c.kingdomId });
      const action: GameAction =
        kind === "game.raid.nominate"
          ? { kind, raidId, slot: 1, kingdomId: c.kingdomId }
          : kind === "game.raid.accept"
            ? { kind, raidId, units: raidUnits }
            : { kind, raidId };
      return {
        owner: kind === "game.raid.accept" ? c : a,
        action,
        observe: async () => {
          if (kind === "game.raid.withdraw") expect((await row("raids", raidId)).status).toBe("canceled");
          else if (kind === "game.raid.accept")
            expect(
              (
                await pool.query(
                  "SELECT 1 FROM kingdom_troops WHERE owner_kingdom_id=$1 AND placement='attacking' AND placement_ref=$2",
                  [c.kingdomId, raidId],
                )
              ).rowCount,
            ).toBe(8);
          else
            expect(
              (await pool.query("SELECT kingdom_id FROM raid_nominations WHERE raid_id=$1", [raidId])).rows,
            ).toEqual([{ kingdom_id: c.kingdomId }]);
        },
      };
    }
  }
}

async function snapshot(): Promise<Record<string, unknown[]>> {
  const tables = await pool.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables
    WHERE table_schema=current_schema() AND table_type='BASE TABLE' AND table_name <> 'command_fault_control' ORDER BY table_name`);
  const state: Record<string, unknown[]> = {};
  for (const { table_name: table } of tables.rows) {
    if (!/^[a-z_][a-z_0-9]*$/.test(table)) throw new Error("Unsafe snapshot identifier");
    state[table] = (
      await pool.query<{ row: unknown }>(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)
    ).rows.map((r) => r.row);
  }
  return state;
}
async function invariants() {
  expect(
    (
      await pool.query(`SELECT b.kingdom_id,b.resource FROM resource_balances b
    LEFT JOIN resource_movements m ON m.product_scope=b.product_scope AND m.kingdom_id=b.kingdom_id AND m.resource=b.resource
    GROUP BY b.kingdom_id,b.resource,b.ordinary_units,b.allowance_units,b.locked_units
    HAVING b.ordinary_units < 0 OR b.allowance_units < 0 OR b.locked_units < 0
      OR b.ordinary_units <> COALESCE(sum(m.ordinary_delta),0)
      OR b.allowance_units <> COALESCE(sum(m.allowance_delta),0)
      OR b.locked_units <> COALESCE(sum(m.locked_delta),0)`)
    ).rows,
  ).toEqual([]);
  expect(
    (
      await pool.query(`SELECT id FROM kingdom_troops t WHERE
    (placement='home' AND (owner_kingdom_id<>host_kingdom_id OR placement_ref IS NOT NULL)) OR
    (placement='visiting' AND NOT EXISTS (SELECT 1 FROM garrison_contracts c WHERE c.id=t.placement_ref AND c.status<>'closed' AND c.lender_kingdom_id=t.owner_kingdom_id AND c.host_kingdom_id=t.host_kingdom_id)) OR
    (placement='scouting' AND NOT EXISTS (SELECT 1 FROM scout_operations s WHERE s.id=t.placement_ref AND s.status='active' AND s.scout_kingdom_id=t.owner_kingdom_id)) OR
    (placement='attacking' AND NOT EXISTS (SELECT 1 FROM raid_contributions c WHERE c.raid_id=t.placement_ref AND c.kingdom_id=t.owner_kingdom_id AND c.status='committed'))`)
    ).rows,
  ).toEqual([]);
  expect(
    (
      await pool.query(
        "SELECT owner_kingdom_id FROM kingdom_troops WHERE home_guard GROUP BY owner_kingdom_id HAVING count(*)<>8",
      )
    ).rows,
  ).toEqual([]);
}

type BalanceRow = {
  kingdom_id: string;
  resource: string;
  ordinary_units: string;
  allowance_units: string;
  locked_units: string;
};
async function balances(): Promise<BalanceRow[]> {
  return (
    await pool.query<BalanceRow>(`SELECT kingdom_id,resource,ordinary_units,allowance_units,locked_units
    FROM resource_balances ORDER BY kingdom_id,resource`)
  ).rows;
}

// Independent rulebook arithmetic, not receipt charges or movement-derived
// deltas. The rows include unrelated kingdoms: their stock must not change.
function expectedBalances(before: BalanceRow[], kind: GameAction["kind"], a: Owner, b: Owner, c: Owner): BalanceRow[] {
  const expected = before.map((row) => ({ ...row }));
  function delta(owner: Owner, resource: string, ordinary = 0, allowance = 0, locked = 0) {
    const balance = expected.find((row) => row.kingdom_id === owner.kingdomId && row.resource === resource);
    if (!balance) throw new Error("Missing independent balance");
    for (const [key, whole] of [
      ["ordinary_units", ordinary],
      ["allowance_units", allowance],
      ["locked_units", locked],
    ] as const)
      balance[key] = (BigInt(balance[key]) + BigInt(whole) * 600n).toString();
  }
  switch (kind) {
    case "game.contact.request":
      delta(a, "silver", -2);
      break;
    case "game.transfer":
      delta(a, "iron", -3);
      delta(b, "iron", 3);
      break;
    case "game.training.queue":
      delta(a, "iron", -10);
      delta(a, "silver", -4);
      break;
    case "game.training.cancel":
      delta(a, "iron", 8);
      {
        // 80% of four Silver is 1,920 internal units, not three rounded resources.
        const silver = expected.find((row) => row.kingdom_id === a.kingdomId && row.resource === "silver");
        if (!silver) throw new Error("Missing cancellation balance");
        silver.ordinary_units = (BigInt(silver.ordinary_units) + 1920n).toString();
      }
      break;
    case "game.building.queue":
      delta(a, "iron", 0, -40);
      delta(a, "silver", 0, -20);
      break;
    case "game.building.cancel":
      delta(a, "iron", 0, 20);
      delta(a, "silver", 0, 10);
      break;
    case "game.supply.sign":
      delta(a, "grain", -1, 0, 1);
      delta(b, "silver", -1, 0, 1);
      break;
    case "game.scout.start":
      delta(a, "silver", -10);
      delta(a, "grain", -5);
      break;
    case "game.garrison.sign":
      delta(a, "iron", -1, 0, 1);
      delta(b, "silver", -1, 0, 1);
      break;
    case "game.garrison.seize":
      delta(a, "iron", 1, 0, -1);
      delta(a, "silver", 1);
      delta(b, "silver", 0, 0, -1);
      break;
    case "game.garrison.exit":
      delta(a, "iron", 0, 0, -1);
      delta(b, "iron", 1);
      delta(b, "silver", 1, 0, -1);
      break;
    case "game.garrison.release":
      delta(a, "iron", 1, 0, -1);
      delta(b, "silver", 1, 0, -1);
      break;
    case "game.raid.declare":
      delta(a, "grain", -21);
      break;
    case "game.raid.accept":
      delta(c, "grain", -21);
      break;
    case "game.contact.answer":
    case "game.message.send":
    case "game.troop.disband":
    case "game.supply.offer":
    case "game.supply.counter":
    case "game.supply.withdraw":
    case "game.supply.notice":
    case "game.supply.refuse":
    case "game.supply.release":
    case "game.scout.share":
    case "game.garrison.offer":
    case "game.garrison.withdraw":
    case "game.raid.nominate":
    case "game.raid.withdraw":
      break;
    default: {
      const exhaustive: never = kind;
      throw new Error(`Missing value model for ${exhaustive}`);
    }
  }
  return expected;
}

const kinds = GameActionSchema.options.map((option) => option.shape.kind.value);
// Public targets may be attacked/contacted by anyone. Existing private objects
// and commands on another owner's units/commitments may not be mutated.
const ownerBoundKinds = new Set<GameAction["kind"]>([
  "game.contact.answer",
  "game.training.cancel",
  "game.troop.disband",
  "game.building.cancel",
  "game.supply.counter",
  "game.supply.sign",
  "game.supply.withdraw",
  "game.supply.notice",
  "game.supply.refuse",
  "game.supply.release",
  "game.scout.share",
  "game.garrison.sign",
  "game.garrison.withdraw",
  "game.garrison.seize",
  "game.garrison.exit",
  "game.garrison.release",
  "game.raid.nominate",
  "game.raid.accept",
  "game.raid.withdraw",
]);
describe("all published gameplay commands: two pre-commit faults and receipt replay", () => {
  it.each(kinds)("%s rolls back every durable table and retries exactly once", async (kind) => {
    await pool.query(`UPDATE world_clocks SET last_heartbeat_at=clock_timestamp(),
      next_tick_due_at=clock_timestamp()+interval '1 hour'`);
    const a = await kingdom();
    const b = await kingdom();
    const c = await kingdom();
    const scenario = await prepare(kind, a, b, c);
    const command = envelope(scenario.owner, scenario.action);
    const ownerPrincipal = principal(scenario.owner);
    const before = await snapshot();
    const outsider = scenario.owner.accountId === c.accountId ? a : c;
    if (ownerBoundKinds.has(kind)) {
      // The envelope still claims the legitimate owner. Authentication, not that
      // claim, determines whose command reaches the handler.
      await expect(dispatcher.dispatch(principal(outsider), { ...command, commandId: randomUUID() })).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    }
    const beforeBalances = await balances();
    const beforeTroops = (
      await pool.query("SELECT id,owner_kingdom_id,type,home_guard FROM kingdom_troops ORDER BY id")
    ).rows;
    const seizedIds =
      scenario.action.kind === "game.garrison.seize"
        ? (
            await pool.query<{ id: string }>(
              "SELECT id FROM kingdom_troops WHERE placement='visiting' AND placement_ref=$1 ORDER BY id",
              [scenario.action.contractId],
            )
          ).rows.map((t) => t.id)
        : [];
    if (kind === "game.garrison.seize") expect(seizedIds).toHaveLength(2);
    try {
      afterHandlerFault = command.commandId;
      await expect(dispatcher.dispatch(ownerPrincipal, command)).rejects.toThrow("FAULT_AFTER_HANDLER");
      afterHandlerFault = null;
      expect(await snapshot()).toEqual(before);
      expect(await dispatcher.lookupReceipt(ownerPrincipal, command.commandId)).toBeNull();
      await pool.query("INSERT INTO command_fault_control VALUES ($1)", [command.commandId]);
      await expect(dispatcher.dispatch(ownerPrincipal, command)).rejects.toThrow("FAULT_AFTER_RECEIPT");
      expect(await snapshot()).toEqual(before);
      expect(await dispatcher.lookupReceipt(ownerPrincipal, command.commandId)).toBeNull();
    } finally {
      afterHandlerFault = null;
      await pool.query("DELETE FROM command_fault_control WHERE command_id=$1", [command.commandId]);
    }
    const receipt = await dispatcher.dispatch(ownerPrincipal, command);
    expect(receipt.code).toBe("COMMITTED");
    expect(Object.keys(receipt.recordVersions).length).toBeGreaterThan(0);
    await scenario.observe();
    expect(await balances()).toEqual(expectedBalances(beforeBalances, kind, a, b, c));
    await invariants();
    const afterTroops = (await pool.query("SELECT id,owner_kingdom_id,type,home_guard FROM kingdom_troops ORDER BY id"))
      .rows;
    const expectedTroops = beforeTroops
      .filter((t) => scenario.action.kind !== "game.troop.disband" || t.id !== scenario.action.troopId)
      .map((t) => (seizedIds.includes(t.id) ? { ...t, owner_kingdom_id: b.kingdomId } : t));
    expect(afterTroops).toEqual(expectedTroops);
    const committed = await snapshot();
    expect(committed).not.toEqual(before);
    expect(await dispatcher.lookupReceipt(ownerPrincipal, command.commandId)).toEqual(receipt);
    expect(await dispatcher.dispatch(ownerPrincipal, command)).toEqual(receipt);
    expect(await dispatcher.lookupReceipt(principal(outsider), command.commandId)).toBeNull();
    await expect(dispatcher.dispatch(principal(outsider), command)).rejects.toThrow("FORBIDDEN");
    expect(
      (
        await dispatcher.dispatch(ownerPrincipal, {
          ...command,
          action: { kind: "game.message.send", recipientKingdomId: c.kingdomId, body: "Changed retry" },
        })
      ).code,
    ).toBe("IDEMPOTENCY_CONFLICT");
    expect(await snapshot()).toEqual(committed);
  });
});
