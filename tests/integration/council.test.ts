import { randomUUID } from "node:crypto";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import { ActionLimitService, CouncilReader, generatedEnvoy, SocialOverviewReader, SocialService } from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let admin: Pool, pool: Pool, schema: string, reader: CouncilReader;
const now = new Date("2026-10-08T12:00:00Z");
async function player() {
  const accountId = randomUUID(),
    kingdomId = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture',now(),'terms-v1')",
    [accountId, `${accountId}@example.test`],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Council fixture','fixture',now(),0,0,60000,$4)",
    [kingdomId, accountId, `council_${accountId.slice(0, 8)}`, randomUUID()],
  );
  return { accountId, kingdomId };
}
beforeAll(async () => {
  admin = createPool(connectionString);
  schema = await createTestSchema(admin, "council");
  pool = createSchemaPool(connectionString, schema);
  reader = new CouncilReader(
    pool,
    "pact",
    new SocialOverviewReader(pool, "pact"),
    async () => ({}),
    () => now,
  );
});
afterAll(async () => {
  await pool?.end();
  if (schema) await dropTestSchema(admin, schema);
  await admin?.end();
});
describe("owner-bound council", () => {
  it("generates stable distinct identities and persists only the authenticated owner's edit", async () => {
    const a = await player(),
      b = await player();
    expect(generatedEnvoy(a.kingdomId)).toEqual(generatedEnvoy(a.kingdomId));
    expect(generatedEnvoy(a.kingdomId).seed).not.toBe(generatedEnvoy(b.kingdomId).seed);
    const character = { name: "No prescribed strategy", seed: "A river traveller", color: "#456789", variation: 12 };
    expect(await reader.customize(a.accountId, character, 1)).toEqual({ character, version: 2 });
    expect(await reader.customize(a.accountId, { ...character, name: "stale overwrite" }, 1)).toBeNull();
    const view = await reader.read(a.accountId, [b.kingdomId], true);
    expect(view?.parties[a.kingdomId]?.character).toEqual(character);
    expect(view?.parties[b.kingdomId]?.character).toEqual(generatedEnvoy(b.kingdomId));
    expect(view?.parties[a.kingdomId]?.ruler.lastObservedAt).toBe(now.toISOString());
    expect(view?.parties[b.kingdomId]?.ruler.lastObservedAt).toBeNull();
    expect(view?.parties[b.kingdomId]?.agent.runActive).toBe(false);
    expect(view?.parties[b.kingdomId]?.agent.lastObservedAt).toBeNull();
    expect(JSON.stringify(view)).not.toContain(a.accountId);
  });
  it("pages the actual exchange without leaking another pair's messages or accepting account ownership", async () => {
    const a = await player(),
      b = await player(),
      c = await player();
    for (let i = 0; i < 45; i++)
      await pool.query(
        "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,$4,true,$1::uuid::text,$5)",
        [randomUUID(), a.kingdomId, b.kingdomId, `Recorded ${i}`, i],
      );
    await pool.query(
      "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,'Private other pair',false,$1::uuid::text,100)",
      [randomUUID(), b.kingdomId, c.kingdomId],
    );
    const first = await reader.thread(a.accountId, b.kingdomId);
    expect(first.messages).toHaveLength(40);
    expect(first.messages[0]?.body).toBe("Recorded 5");
    expect(first.next).not.toBeNull();
    const older = await reader.thread(a.accountId, b.kingdomId, first.next ?? undefined);
    expect(older.messages).toHaveLength(5);
    expect(older.next).toBeNull();
    expect((await reader.thread(a.accountId, c.kingdomId)).messages).toEqual([]);
    expect((await reader.thread(randomUUID(), b.kingdomId)).messages).toEqual([]);
    expect(JSON.stringify(first)).not.toContain("Private other pair");
    const unread = async (recipient: string) =>
      Number(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NULL",
            [recipient],
          )
        ).rows[0].n,
      );
    expect(await unread(b.kingdomId)).toBe(45); // sender reads never acknowledge the recipient's messages
    const pair = [a.kingdomId, b.kingdomId].sort();
    await pool.query(
      "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,0)",
      pair,
    );
    const social = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), {
      now: () => now,
    });
    const send = async () => {
      const client = await pool.connect();
      try {
        return await social.sendMessage(client, {
          accountId: a.accountId,
          recipientKingdomId: b.kingdomId,
          body: "Next actual message",
          agentOriginated: true,
          operationKey: randomUUID(),
          gameTimeMs: 1000,
        });
      } finally {
        client.release();
      }
    };
    await expect(send()).rejects.toMatchObject({ code: "MESSAGE_QUEUE_FULL" });
    await reader.thread(c.accountId, a.kingdomId);
    expect(await unread(b.kingdomId)).toBe(45);
    const delivered = await reader.thread(b.accountId, a.kingdomId);
    expect(await unread(b.kingdomId)).toBe(5); // the 41st lookahead and older rows are not delivered
    expect(await unread(c.kingdomId)).toBe(1); // unrelated pair is untouched
    const readTimes = (
      await pool.query(
        "SELECT read_game_time_ms FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NOT NULL ORDER BY id",
        [b.kingdomId],
      )
    ).rows;
    await reader.thread(b.accountId, a.kingdomId);
    expect(
      (
        await pool.query(
          "SELECT read_game_time_ms FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NOT NULL ORDER BY id",
          [b.kingdomId],
        )
      ).rows,
    ).toEqual(readTimes);
    await reader.thread(b.accountId, a.kingdomId, delivered.next ?? undefined);
    expect(await unread(b.kingdomId)).toBe(0);
    await expect(send()).resolves.toBeTypeOf("string");
    expect(await unread(b.kingdomId)).toBe(1);
  });
  it("exports, forgets and prunes the new identity/activity data", async () => {
    const a = await player();
    await reader.customize(
      a.accountId,
      { name: "River", seed: "public inspiration", color: "#456789", variation: 2 },
      1,
    );
    await reader.read(a.accountId, [], true);
    const client = await pool.connect();
    try {
      expect(JSON.stringify(await reader.retention.exportAccount(client, a.accountId))).toContain("public inspiration");
      await reader.retention.forgetAccount(client, a.accountId);
      const row = (
        await pool.query("SELECT envoy_character,ruler_observed_at FROM kingdoms WHERE id=$1", [a.kingdomId])
      ).rows[0];
      expect(row).toEqual({ envoy_character: null, ruler_observed_at: null });
    } finally {
      client.release();
    }
  });
});
