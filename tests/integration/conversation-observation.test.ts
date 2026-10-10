import { randomUUID } from "node:crypto";
import { SocialCommandHandler } from "@pact/application";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { ActionLimitService, ConversationHistoryReader, SocialService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string, history: ConversationHistoryReader, social: SocialService;
beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "observation");
  pool = createSchemaPool(connectionString, schema);
  history = new ConversationHistoryReader(pool, "pact");
  social = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), {
    now: () => new Date("2026-10-10T10:00:00Z"),
  });
});
afterAll(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
async function player() {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture',now(),'terms-v1')",
    [accountId, `${accountId}@example.test`],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Synthetic observer','fixture',now(),0,0,60000,$4)",
    [kingdomId, accountId, `observe_${accountId.slice(0, 8)}`, randomUUID()],
  );
  return { accountId, kingdomId };
}
describe("named, mutually-consented conversation observation", () => {
  it("requires both owners, binds the named observer, preserves unread state and immediately honors revocation/block/forget", async () => {
    const a = await player(),
      b = await player(),
      observer = await player(),
      foreign = await player();
    for (let i = 0; i < 12; i++)
      await pool.query(
        "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,$4,true,$1::uuid::text,$5)",
        [randomUUID(), a.kingdomId, b.kingdomId, "🦆".repeat(4096), i],
      );
    const consent = (owner: typeof a, peer: typeof a, enabled: boolean, version: number) =>
      withTransaction(pool, (c) =>
        social.configureObservation(
          c,
          owner.accountId,
          { peerKingdomId: peer.kingdomId, observerKingdomId: observer.kingdomId, enabled, expectedVersion: version },
          1000,
        ),
      );
    expect(await history.observed(observer.accountId, a.kingdomId, b.kingdomId)).toBeNull();
    await consent(a, b, true, 0);
    expect((await history.observations(observer.accountId)).pairs).toEqual([]);
    await consent(b, a, true, 0);
    expect((await history.observations(observer.accountId)).pairs).toHaveLength(1);
    expect((await history.observations(foreign.accountId)).pairs).toEqual([]);
    expect(await history.observed(foreign.accountId, a.kingdomId, b.kingdomId)).toBeNull();
    const seen = new Set<string>();
    let cursor: { gameTimeMs: string; id: string } | undefined;
    do {
      const page = await history.observed(observer.accountId, a.kingdomId, b.kingdomId, cursor);
      expect(page).not.toBeNull();
      if (!page) throw Error("fixture");
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(64000);
      for (const m of page.messages) {
        expect(m.body).toBe("🦆".repeat(4096));
        expect(seen.has(m.id)).toBe(false);
        seen.add(m.id);
      }
      cursor = page.next ?? undefined;
    } while (cursor);
    expect(seen.size).toBe(12);
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM direct_messages WHERE read_game_time_ms IS NULL")).rows[0].n,
    ).toBe(12);
    await consent(a, b, false, 1);
    expect(await history.observed(observer.accountId, a.kingdomId, b.kingdomId)).toBeNull();
    await expect(consent(a, b, true, 1)).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
    await consent(a, b, true, 2);
    await pool.query(
      "INSERT INTO social_blocks(product_scope,blocker_kingdom_id,blocked_kingdom_id,created_game_time_ms) VALUES('pact',$1,$2,1000)",
      [b.kingdomId, observer.kingdomId],
    );
    expect(await history.observed(observer.accountId, a.kingdomId, b.kingdomId)).toBeNull();
    await pool.query("DELETE FROM social_blocks WHERE blocker_kingdom_id=$1", [b.kingdomId]);
    const own = await withTransaction(pool, (c) => social.retention.exportAccount(c, a.accountId));
    expect(own.observationConsents).toHaveLength(1);
    expect(
      (await withTransaction(pool, (c) => social.retention.exportAccount(c, observer.accountId))).observationConsents,
    ).toHaveLength(0);
    await withTransaction(pool, (c) => social.retention.forgetAccount(c, b.accountId));
    expect(await history.observed(observer.accountId, a.kingdomId, b.kingdomId)).toBeNull();
    expect(await history.consents(a.accountId, b.kingdomId)).toEqual([]);
  });
  it("cannot be enrolled by a model or caller-supplied ownership", async () => {
    const a = await player(),
      b = await player(),
      observer = await player();
    const handler = new SocialCommandHandler({} as never, undefined, undefined, undefined, undefined, social);
    await expect(
      withTransaction(pool, (c) =>
        handler.execute(
          c,
          { audience: "agent", accountId: a.accountId } as never,
          {
            schemaVersion: "pact.social-command.v2",
            commandId: randomUUID(),
            action: {
              kind: "conversation.observation",
              peerKingdomId: b.kingdomId,
              observerKingdomId: observer.kingdomId,
              enabled: true,
              expectedVersion: 0,
            },
          },
          0,
        ),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await history.observations(observer.accountId)).pairs).toEqual([]);
    await expect(
      withTransaction(pool, (c) =>
        social.configureObservation(
          c,
          randomUUID(),
          { peerKingdomId: a.kingdomId, observerKingdomId: observer.kingdomId, enabled: true, expectedVersion: 0 },
          0,
        ),
      ),
    ).rejects.toMatchObject({ code: "KINGDOM_NOT_FOUND" });
  });
});
