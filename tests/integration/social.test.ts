import { randomUUID } from "node:crypto";
import { AgentGuideReader } from "@pact/application";
import { ExposureService } from "@pact/authority";
import { ObservedRequestReferenceSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import {
  ActionLimitService,
  ConversationReader,
  ImmediateExposureAdapter,
  SocialOverviewReader,
  SocialService,
  WorldViewService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { WorldClockService } from "@pact/world";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool;
let pool: Pool;
let schema: string;
let ledger: ResourceLedger;
let limits: ActionLimitService;
let social: SocialService;
let now: Date;

beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "social");
  pool = createSchemaPool(connectionString, schema);
  ledger = new ResourceLedger("pact");
  limits = new ActionLimitService("pact");
  now = new Date("2026-09-23T00:00:00Z");
  social = new SocialService("pact", ledger, limits, { now: () => now });
});

afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});

async function kingdom(): Promise<{ accountId: string; kingdomId: string }> {
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  await withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version)
       VALUES ($1, 'pact', $2, 'fixture-only', clock_timestamp(), 'terms-v1')`,
      [accountId, `${accountId}@example.test`],
    );
    await client.query(
      `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait,
         activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
       VALUES ($1, 'pact', $2, $3, 'Social Fixture', 'portrait.wolf', clock_timestamp(),
         0, 0, 60000, $4)`,
      [kingdomId, accountId, `social_${randomUUID().slice(0, 8)}`, randomUUID()],
    );
    await ledger.initializeKingdom(client, kingdomId, 0);
  });
  return { accountId, kingdomId };
}

async function credit(kingdomId: string, resource: "iron" | "silver" | "grain", whole: number): Promise<void> {
  await withTransaction(pool, (client) =>
    ledger.creditOrdinary(client, {
      kingdomId,
      resource,
      amount: wholeResources(whole),
      operationKey: `fixture:${randomUUID()}`,
      reason: "fixture",
      gameTimeMs: 0,
    }),
  );
}

async function connect(
  sender: { accountId: string; kingdomId: string },
  recipient: { accountId: string; kingdomId: string },
) {
  const requestId = await withTransaction(pool, (client) =>
    social.requestContact(client, {
      accountId: sender.accountId,
      recipientKingdomId: recipient.kingdomId,
      note: "Hello",
      operationKey: randomUUID(),
      gameTimeMs: 60_000,
    }),
  );
  await withTransaction(pool, (client) =>
    social.answerRequest(client, { accountId: recipient.accountId, requestId, accept: true, gameTimeMs: 120_000 }),
  );
}

describe("contacts, messages, and transfers", () => {
  it("rejects outgoing, nonexistent, wrong-role and expired request IDs without revealing outsider state", async () => {
    const sender = await kingdom(),
      recipient = await kingdom(),
      outsider = await kingdom();
    const id = await withTransaction(pool, (c) =>
      social.requestContact(c, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        note: "Review a trial",
        operationKey: randomUUID(),
        gameTimeMs: 60000,
      }),
    );
    const answer = (accountId: string, requestId: string, gameTimeMs = 120000) =>
      withTransaction(pool, (c) => social.answerRequest(c, { accountId, requestId, accept: true, gameTimeMs }));
    for (const [accountId, requestId] of [
      [sender.accountId, id],
      [outsider.accountId, id],
      [recipient.accountId, randomUUID()],
      [recipient.accountId, sender.kingdomId],
      [recipient.accountId, "00000000-0000-0000-0000-000000000000"],
    ] as const)
      await expect(answer(accountId, requestId)).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
    const expiry = Number(
      (await pool.query("SELECT expires_game_time_ms FROM cold_contact_requests WHERE id=$1", [id])).rows[0]
        .expires_game_time_ms,
    );
    await expect(answer(recipient.accountId, id, expiry)).rejects.toMatchObject({ code: "REQUEST_EXPIRED" });
    expect((await new SocialOverviewReader(pool, "pact").read(outsider.accountId))?.requests).toEqual([]);
    await new WorldClockService(pool, "pact").bootstrap();
    await pool.query("UPDATE world_clocks SET committed_game_time_ms=120000 WHERE product_scope='pact'");
    const guide = new AgentGuideReader(new WorldViewService(pool, "pact"), new SocialOverviewReader(pool, "pact"), {
      getMandate: async () => null,
    });
    for (const [party, direction] of [
      [sender, "outgoing"],
      [recipient, "incoming"],
    ] as const) {
      const read = await guide.read(party.accountId, "start");
      const reference = (read.contactRequests as { id: string; reference: unknown }[]).find(
        (r) => r.id === id,
      )?.reference;
      expect(ObservedRequestReferenceSchema.parse(reference)).toMatchObject({
        id,
        type: "ContactRequest",
        direction,
        ownerKingdomId: party.kingdomId,
      });
    }
    await answer(recipient.accountId, id);
    expect((await pool.query("SELECT status FROM cold_contact_requests WHERE id=$1", [id])).rows[0].status).toBe(
      "accepted",
    );
  });

  it("requires owner delegation, checks allow-list and revocation, and grants no contract authority", async () => {
    const sender = await kingdom(),
      recipient = await kingdom();
    const requestId = await withTransaction(pool, (c) =>
      social.requestContact(c, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        note: "We can negotiate",
        operationKey: randomUUID(),
        gameTimeMs: 60000,
      }),
    );
    const answer = () =>
      withTransaction(pool, (c) =>
        social.answerRequest(c, {
          accountId: recipient.accountId,
          requestId,
          accept: true,
          gameTimeMs: 120000,
          actorKind: "agent",
        }),
      );
    await expect(answer()).rejects.toMatchObject({ code: "DELEGATION_REQUIRED" });
    await withTransaction(pool, (c) =>
      social.configureDelegation(
        c,
        recipient.accountId,
        { mode: "allowlist", allowedKingdomIds: [], expectedVersion: 0 },
        120000,
      ),
    );
    await expect(answer()).rejects.toMatchObject({ code: "DELEGATION_REQUIRED" });
    await withTransaction(pool, (c) =>
      social.configureDelegation(
        c,
        recipient.accountId,
        { mode: "agent_decides", allowedKingdomIds: [], expectedVersion: 1 },
        120000,
      ),
    );
    await answer();
    await answer();
    expect(
      (await pool.query("SELECT count(*)::int n FROM kingdom_mandates WHERE account_id=$1", [recipient.accountId]))
        .rows[0].n,
    ).toBe(0);
    await withTransaction(pool, (c) =>
      social.configureDelegation(
        c,
        recipient.accountId,
        { mode: "manual", allowedKingdomIds: [], expectedVersion: 2 },
        120000,
      ),
    );
    await expect(answer()).rejects.toMatchObject({ code: "DELEGATION_REQUIRED" });
    await expect(
      withTransaction(pool, (c) =>
        social.configureDelegation(
          c,
          recipient.accountId,
          { mode: "agent_decides", allowedKingdomIds: [], expectedVersion: 2 },
          120000,
        ),
      ),
    ).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
  });
  it("returns service retry time without charging or dropping text; retries preserve IDs", async () => {
    const sender = await kingdom(),
      recipient = await kingdom();
    await connect(sender, recipient);
    const send = (n: number, body = "x") =>
      withTransaction(pool, (c) =>
        social.sendMessage(c, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body,
          agentOriginated: true,
          operationKey: `burst-${n}`,
          gameTimeMs: 180000 + n,
        }),
      );
    for (let n = 0; n < 9; n++) await send(n);
    await expect(send(9)).rejects.toMatchObject({ code: "SERVICE_THROTTLED", retryAfterMs: 3000 });
    expect(
      (await pool.query("SELECT count(*)::int n FROM direct_messages WHERE sender_kingdom_id=$1", [sender.kingdomId]))
        .rows[0].n,
    ).toBe(9);
    now = new Date(now.getTime() + 3000);
    const id = await send(9, "😀".repeat(4096));
    expect(await send(9, "😀".repeat(4096))).toBe(id);
    await expect(send(10, "😀".repeat(4097))).rejects.toMatchObject({ code: "MESSAGE_TOO_LONG" });
    const reader = new ConversationReader(pool, "pact");
    expect((await reader.read(recipient.accountId, sender.kingdomId, 1))?.messages[0]?.body).toBe("😀".repeat(4096));
  });

  it("allows more than eight free introductions and supports 20/50/100 relationships", async () => {
    const owner = await kingdom();
    for (let n = 0; n < 100; n++) {
      now = new Date(now.getTime() + 3000);
      const peer = await kingdom();
      await connect(owner, peer);
      if ([19, 49, 99].includes(n))
        expect(
          (
            await pool.query("SELECT count(*)::int n FROM social_contacts WHERE kingdom_a=$1 OR kingdom_b=$1", [
              owner.kingdomId,
            ])
          ).rows[0].n,
        ).toBe(n + 1);
    }
    expect((await withTransaction(pool, (c) => ledger.readBalance(c, owner.kingdomId, "silver"))).ordinary).toBe(0n);
    expect(
      await withTransaction(pool, (c) => limits.rollingStatus(c, owner.kingdomId, "cold_contact", 60000)),
    ).toMatchObject({ used: 100, limit: null });
    const overview = new SocialOverviewReader(pool, "pact");
    const first = await overview.read(owner.accountId);
    const second = await overview.read(owner.accountId, { contactOffset: first?.contactsNextOffset ?? 0 });
    expect(first?.contacts).toHaveLength(50);
    expect(second?.contacts).toHaveLength(50);
    expect(new Set([...(first?.contacts ?? []), ...(second?.contacts ?? [])].map((c) => c.kingdomId)).size).toBe(100);
    expect(second?.contactsNextOffset).toBeNull();
  });

  it("uses byte backpressure without losing text and makes concurrent sender bursts atomic", async () => {
    const a = await kingdom(),
      b = await kingdom();
    await connect(a, b);
    await pool.query(
      "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) SELECT gen_random_uuid(),'pact',$1,$2,$3,true,'capacity-'||n::text,n FROM generate_series(1,1024) n",
      [a.kingdomId, b.kingdomId, "🦆".repeat(4096)],
    );
    const attempt = (key: string) =>
      withTransaction(pool, (c) =>
        social.sendMessage(c, {
          accountId: a.accountId,
          recipientKingdomId: b.kingdomId,
          body: "One new statement",
          agentOriginated: true,
          operationKey: key,
          gameTimeMs: 180000,
        }),
      );
    await expect(attempt("capacity-retry")).rejects.toMatchObject({ code: "MESSAGE_QUEUE_FULL" });
    expect(
      (await pool.query("SELECT count(*)::int n FROM direct_messages WHERE sender_kingdom_id=$1", [a.kingdomId]))
        .rows[0].n,
    ).toBe(1024);
    const page = await new ConversationReader(pool, "pact").read(b.accountId, a.kingdomId);
    expect(page?.messages.filter((m) => m.body !== null).length).toBeGreaterThan(0);
    const retryExact = async (key: string): Promise<string> => {
      for (let n = 0; ; n++)
        try {
          return await attempt(key);
        } catch (error) {
          if (
            n >= 10 ||
            !error ||
            typeof error !== "object" ||
            !("code" in error) ||
            !["40001", "40P01"].includes(String(error.code))
          )
            throw error;
        }
    };
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, n) => retryExact(`concurrent-${n}`)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(9);
    for (const result of results)
      if (result.status === "rejected")
        expect(result.reason).toMatchObject({ code: "SERVICE_THROTTLED", retryAfterMs: 3000 });
    expect(
      (await pool.query("SELECT count(*)::int n FROM direct_messages WHERE sender_kingdom_id=$1", [a.kingdomId]))
        .rows[0].n,
    ).toBe(1033);
  });

  it("delivers a fifth unread message without a daily quota and blocks both directions", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    await connect(sender, recipient);
    for (let n = 0; n < 4; n += 1) {
      await withTransaction(pool, (client) =>
        social.sendMessage(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body: `Message ${n}`,
          agentOriginated: true,
          operationKey: `message-${n}`,
          gameTimeMs: 180_000 + n,
        }),
      );
    }
    const fifthInput = {
      accountId: sender.accountId,
      recipientKingdomId: recipient.kingdomId,
      body: "Fifth",
      agentOriginated: true,
      operationKey: "fifth",
      gameTimeMs: 190000,
    };
    const fifth = await withTransaction(pool, (c) => social.sendMessage(c, fifthInput));
    expect(await withTransaction(pool, (c) => social.sendMessage(c, fifthInput))).toBe(fifth);
    expect(
      await withTransaction(pool, (c) => limits.rollingStatus(c, sender.kingdomId, "outgoing_message", 190000)),
    ).toMatchObject({ used: 5, limit: null });
    expect(await withTransaction(pool, (c) => social.markRead(c, recipient.accountId, sender.kingdomId, 200000))).toBe(
      5,
    );
    await withTransaction(pool, (client) =>
      social.setBlock(client, recipient.accountId, sender.kingdomId, true, 220_000),
    );
    await expect(
      withTransaction(pool, (client) =>
        social.sendMessage(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          body: "Blocked",
          agentOriginated: false,
          operationKey: "blocked",
          gameTimeMs: 230_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
    await expect(
      withTransaction(pool, (client) =>
        social.assertDirectCommunicationAllowed(client, recipient.kingdomId, sender.kingdomId),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
    await expect(
      withTransaction(pool, (client) =>
        social.transfer(client, {
          accountId: recipient.accountId,
          recipientKingdomId: sender.kingdomId,
          resource: "grain",
          wholeAmount: 1,
          operationKey: "blocked-gift",
          gameTimeMs: 230_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "BLOCKED" });
  });

  it("acknowledges only actually returned incoming messages and frees the send queue", async () => {
    const sender = await kingdom(),
      recipient = await kingdom(),
      outsider = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    await connect(sender, recipient);
    const ids: string[] = [];
    for (let n = 0; n < 4; n++)
      ids.push(
        await withTransaction(pool, (client) =>
          social.sendMessage(client, {
            accountId: sender.accountId,
            recipientKingdomId: recipient.kingdomId,
            body: `Read fixture ${n}`,
            agentOriginated: true,
            operationKey: randomUUID(),
            gameTimeMs: 300000 + n,
          }),
        ),
      );
    const reader = new ConversationReader(pool, "pact");
    await reader.read(outsider.accountId, sender.kingdomId, 5);
    await reader.read(sender.accountId, recipient.kingdomId, 5);
    const unread = async () =>
      Number(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM direct_messages WHERE id=ANY($1::uuid[]) AND read_game_time_ms IS NULL",
            [ids],
          )
        ).rows[0].n,
      );
    expect(await unread()).toBe(4);
    const overview = new SocialOverviewReader(pool, "pact");
    const exchanges = await overview.read(recipient.accountId);
    expect(exchanges?.messages.filter((m) => ids.includes(m.id)).every((m) => m.authorKind === "agent")).toBe(true);
    expect(exchanges?.messages.filter((m) => ids.includes(m.id))).toHaveLength(4);
    expect(await unread()).toBe(4); // agent guide does not deliver message bodies
    await reader.read(recipient.accountId, sender.kingdomId, 2);
    expect(await unread()).toBe(2);
    await reader.read(recipient.accountId, sender.kingdomId, 2);
    expect(await unread()).toBe(0); // unread-first selection prevents starvation by repeated latest pages
    const next = await withTransaction(pool, (client) =>
      social.sendMessage(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        body: "Next message",
        agentOriginated: true,
        operationKey: randomUUID(),
        gameTimeMs: 400000,
      }),
    );
    ids.push(next);
    expect(await unread()).toBe(1);
    await overview.read(recipient.accountId, { acknowledgeDeliveredMessages: true });
    expect(await unread()).toBe(0);
    const omitted = await withTransaction(pool, (client) =>
      social.sendMessage(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        body: "🦆".repeat(4096),
        agentOriginated: true,
        operationKey: randomUUID(),
        gameTimeMs: 500000,
      }),
    );
    ids.push(omitted);
    expect(
      (await reader.read(recipient.accountId, sender.kingdomId, 5, 1000))?.messages.find((m) => m.messageId === omitted)
        ?.bodyOmitted,
    ).toBe(true);
    expect(await unread()).toBe(1); // omitted bytes were not read by the agent
    for (let n = 0; n < 3; n++)
      ids.push(
        await withTransaction(pool, (client) =>
          social.sendMessage(client, {
            accountId: sender.accountId,
            recipientKingdomId: recipient.kingdomId,
            body: "\u0001".repeat(200),
            agentOriginated: true,
            operationKey: randomUUID(),
            gameTimeMs: 600000 + n,
          }),
        ),
      );
    const bounded = await reader.read(recipient.accountId, sender.kingdomId, 5, 3600);
    expect(Buffer.byteLength(JSON.stringify(bounded), "utf8")).toBeLessThanOrEqual(3600);
    expect(await unread()).toBe(2); // the escaped body omitted by the total page budget stays unread too
    const excerpt = await reader.read(recipient.accountId, sender.kingdomId, 3, 1_000);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(1_000);
    expect(await unread()).toBe(2); // a smaller initial-context budget also preserves omitted messages
  });

  it("uses a one-use direct invitation and commits an ordinary transfer once with overflow", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await credit(sender.kingdomId, "grain", 10);
    const cap = (await withTransaction(pool, (client) => ledger.readBalance(client, recipient.kingdomId, "grain")))
      .storageCap;
    await withTransaction(pool, (client) =>
      ledger.creditOrdinary(client, {
        kingdomId: recipient.kingdomId,
        resource: "grain",
        amount: cap - wholeResources(1),
        operationKey: "fill-recipient",
        reason: "fixture",
        gameTimeMs: 0,
      }),
    );
    const input = {
      accountId: sender.accountId,
      recipientKingdomId: recipient.kingdomId,
      resource: "grain" as const,
      wholeAmount: 3,
      operationKey: "gift-1",
      gameTimeMs: 180_000,
    };
    const first = await withTransaction(pool, (client) => social.transfer(client, input));
    expect(first).toMatchObject({ credited: wholeResources(1), overflow: wholeResources(2) });
    expect(await withTransaction(pool, (client) => social.transfer(client, input))).toEqual(first);
    const sourceBalance = await withTransaction(pool, (client) =>
      ledger.readBalance(client, sender.kingdomId, "grain"),
    );
    expect(sourceBalance.ordinary).toBe(wholeResources(7));
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, sender.kingdomId, "transfer", 180_000)),
    ).toMatchObject({ used: 1 });
    expect(
      await withTransaction(pool, (client) =>
        limits.rollingStatus(client, sender.kingdomId, "outgoing_message", 180_000),
      ),
    ).toMatchObject({ used: 0 });
  });

  it("expires cold requests on game time and invitation tokens on real time", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 2);
    const requestId = await withTransaction(pool, (client) =>
      social.requestContact(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        note: "Seven-day request",
        operationKey: randomUUID(),
        gameTimeMs: 60_000,
      }),
    );
    expect(
      await withTransaction(pool, (client) => social.expireRequests(client, 60_000 + 7 * 86_400_000)),
    ).toBeGreaterThanOrEqual(1);
    await expect(
      withTransaction(pool, (client) =>
        social.answerRequest(client, {
          accountId: recipient.accountId,
          requestId,
          accept: true,
          gameTimeMs: 60_000 + 7 * 86_400_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    now = new Date(now.getTime() + 8 * 86_400_000);
    await expect(
      withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000)),
    ).rejects.toMatchObject({ code: "INVITATION_INVALID" });
  });

  it("rejects an unaffordable transfer without consuming quota or creating a recipient credit", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    const token = await withTransaction(pool, (client) =>
      social.issueDirectInvitation(client, sender.accountId, 60_000),
    );
    await withTransaction(pool, (client) => social.acceptDirectInvitation(client, recipient.accountId, token, 120_000));
    await expect(
      withTransaction(pool, (client) =>
        social.transfer(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          resource: "silver",
          wholeAmount: 1,
          operationKey: "unfunded",
          gameTimeMs: 180_000,
        }),
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(
      await withTransaction(pool, (client) => limits.rollingStatus(client, sender.kingdomId, "transfer", 180_000)),
    ).toMatchObject({ used: 0 });
    expect(
      (await withTransaction(pool, (client) => ledger.readBalance(client, recipient.kingdomId, "silver"))).ordinary,
    ).toBe(0n);
  });

  it("charges agent transfers to the shared immediate authority window atomically", async () => {
    const sender = await kingdom();
    const recipient = await kingdom();
    await credit(sender.kingdomId, "silver", 5);
    await connect(sender, recipient);
    await pool.query(
      `INSERT INTO kingdom_mandates(product_scope, account_id, allowed_actions, resource_limits)
       VALUES ('pact', $1, ARRAY['transfer'], $2::jsonb)`,
      [sender.accountId, JSON.stringify({ silver: String(wholeResources(3)) })],
    );
    const agentSocial = new SocialService(
      "pact",
      ledger,
      limits,
      { now: () => now },
      new ImmediateExposureAdapter(new ExposureService("pact")),
    );
    await withTransaction(pool, (client) =>
      agentSocial.transfer(client, {
        accountId: sender.accountId,
        recipientKingdomId: recipient.kingdomId,
        resource: "silver",
        wholeAmount: 3,
        operationKey: "agent-gift-one",
        actorKind: "agent",
        gameTimeMs: 180_000,
      }),
    );
    await expect(
      withTransaction(pool, (client) =>
        agentSocial.transfer(client, {
          accountId: sender.accountId,
          recipientKingdomId: recipient.kingdomId,
          resource: "silver",
          wholeAmount: 1,
          operationKey: "agent-gift-two",
          actorKind: "agent",
          gameTimeMs: 180_000,
        }),
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_ALLOWANCE" });
    expect(
      (
        await pool.query("SELECT sum(units)::text AS total FROM authority_spends WHERE account_id = $1", [
          sender.accountId,
        ])
      ).rows[0]?.total,
    ).toBe(String(wholeResources(3)));
    expect(
      (await withTransaction(pool, (client) => ledger.readBalance(client, sender.kingdomId, "silver"))).ordinary,
    ).toBe(wholeResources(2));
  });
});
