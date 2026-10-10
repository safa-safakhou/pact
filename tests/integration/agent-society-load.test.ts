import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import {
  ActionLimitService,
  CouncilReader,
  PrivateMemoryService,
  SocialOverviewReader,
  SocialService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { PrivacyService } from "@pact/privacy";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
let pool: Pool, admin: Pool, schema: string;
const now = new Date("2026-10-10T12:00:00Z");
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "societyload");
  pool = createSchemaPool(url, schema);
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
    "INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version) VALUES($1,'pact',$2,'fixture-only',$3,'terms-v1')",
    [accountId, `${accountId}@example.test`, now],
  );
  await pool.query(
    "INSERT INTO kingdoms(id,product_scope,account_id,handle,display_name,portrait,activated_at,activated_game_time_ms,activated_tick_sequence,first_tick_game_time_ms,activation_event_id) VALUES($1,'pact',$2,$3,'Synthetic load fixture','portrait.wolf',$4,0,0,60000,$5)",
    [kingdomId, accountId, `load_${accountId.slice(0, 8)}`, now, randomUUID()],
  );
  return { accountId, kingdomId };
}
describe("synthetic 20/50/100 relationship read load", () => {
  for (const count of [20, 50, 100])
    it(`delivers ${count} relationships with bounded whole bodies, history, memory and observer privacy`, async () => {
      const owner = await player(),
        observer = await player(),
        foreign = await player(),
        peers = [];
      const social = new SocialOverviewReader(pool, "pact"),
        council = new CouncilReader(pool, "pact", social, async () => ({})),
        memory = new PrivateMemoryService(pool, "pact", { now: () => now, read: async () => ({ gameTimeMs: 100000 }) });
      const latency: number[] = [],
        measure = async <T>(operation: () => Promise<T>) => {
          const start = performance.now();
          const result = await operation();
          latency.push(performance.now() - start);
          return result;
        };
      for (let i = 0; i < count; i++) {
        const peer = await player();
        peers.push(peer);
        const [a, b] = [owner.kingdomId, peer.kingdomId].sort();
        await pool.query(
          "INSERT INTO social_contacts(product_scope,kingdom_a,kingdom_b,accepted_game_time_ms) VALUES('pact',$1,$2,$3)",
          [a, b, i],
        );
        for (let j = 0; j < 3; j++) {
          const id = randomUUID();
          await pool.query(
            "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,$4,true,$1::uuid::text,$5)",
            [id, peer.kingdomId, owner.kingdomId, j === 0 ? "🦆".repeat(4096) : `Synthetic ${i}:${j}`, 100 + j],
          );
        }
        await memory.write(owner.accountId, "human", {
          schemaVersion: "pact.memory-command.v2",
          commandId: randomUUID(),
          entryId: randomUUID(),
          expectedVersion: 0,
          kind: "assessment",
          topic: "load fixture",
          peerKingdomId: peer.kingdomId,
          text: `Private assessment of synthetic relationship ${i}`,
          sources: [],
        });
      }
      const seen = new Set<string>();
      let offset: number | null = 0;
      do {
        const page = await measure(() =>
          social.read(owner.accountId, { acknowledgeDeliveredMessages: false, contactOffset: offset ?? 0 }),
        );
        if (!page) throw Error("fixture");
        for (const peer of page.contacts) {
          expect(seen.has(peer.kingdomId)).toBe(false);
          seen.add(peer.kingdomId);
        }
        offset = page.contactsNextOffset;
      } while (offset !== null);
      expect(seen.size).toBe(count);
      const first = peers[0];
      if (!first) throw Error("fixture");
      for (let i = 0; i < 85; i++) {
        const id = randomUUID();
        await pool.query(
          "INSERT INTO direct_messages(id,product_scope,sender_kingdom_id,recipient_kingdom_id,body,agent_originated,operation_key,sent_game_time_ms) VALUES($1::uuid,'pact',$2,$3,$4,true,$1::uuid::text,$5)",
          [id, first.kingdomId, owner.kingdomId, "🦆".repeat(4096), 1000 + i],
        );
      }
      const unreadBefore = (
        await pool.query(
          "SELECT count(*)::int n FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NULL",
          [owner.kingdomId],
        )
      ).rows[0].n;
      expect((await council.thread(foreign.accountId, first.kingdomId)).messages).toEqual([]);
      expect(await council.history.observed(observer.accountId, owner.kingdomId, first.kingdomId)).toBeNull();
      const service = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), {
        now: () => now,
      });
      await withTransaction(pool, (c) =>
        service.configureObservation(
          c,
          owner.accountId,
          { peerKingdomId: first.kingdomId, observerKingdomId: observer.kingdomId, enabled: true, expectedVersion: 0 },
          100000,
        ),
      );
      expect(await council.history.observed(observer.accountId, owner.kingdomId, first.kingdomId)).toBeNull();
      await withTransaction(pool, (c) =>
        service.configureObservation(
          c,
          first.accountId,
          { peerKingdomId: owner.kingdomId, observerKingdomId: observer.kingdomId, enabled: true, expectedVersion: 0 },
          100000,
        ),
      );
      let cursor: { gameTimeMs: string; id: string } | undefined;
      const messages = new Set<string>();
      do {
        const page = await measure(() =>
          council.history.observed(observer.accountId, owner.kingdomId, first.kingdomId, cursor),
        );
        if (!page) throw Error("fixture");
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(64000);
        for (const m of page.messages) {
          expect(messages.has(m.id)).toBe(false);
          messages.add(m.id);
          expect(m.body.length).toBeGreaterThan(0);
        }
        cursor = page.next ?? undefined;
      } while (cursor);
      expect(messages.size).toBe(88);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int n FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NULL",
            [owner.kingdomId],
          )
        ).rows[0].n,
      ).toBe(unreadBefore);
      const delivered = new Set<string>();
      cursor = undefined;
      do {
        const page = await measure(() => council.thread(owner.accountId, first.kingdomId, cursor));
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(64000);
        for (const m of page.messages) {
          expect(delivered.has(m.id)).toBe(false);
          delivered.add(m.id);
        }
        cursor = page.next ?? undefined;
      } while (cursor);
      expect(delivered.size).toBe(88);
      expect(
        (
          await pool.query(
            "SELECT count(*)::int n FROM direct_messages WHERE recipient_kingdom_id=$1 AND read_game_time_ms IS NULL",
            [owner.kingdomId],
          )
        ).rows[0].n,
      ).toBe(unreadBefore - 88);
      const notes = new Set<string>();
      let noteCursor: { beforeGameTimeMs: string; beforeEntryId: string } | null = null;
      do {
        const page = await measure(() => memory.read(owner.accountId, noteCursor ?? {}));
        for (const n of page.entries) {
          const id = n.entryId;
          if (typeof id !== "string") throw Error("Invalid note identity");
          expect(notes.has(id)).toBe(false);
          notes.add(id);
        }
        if (page.next) {
          const { beforeGameTimeMs, beforeEntryId } = page.next;
          if (typeof beforeGameTimeMs !== "string" || typeof beforeEntryId !== "string")
            throw Error("Invalid note cursor");
          noteCursor = { beforeGameTimeMs, beforeEntryId };
        } else noteCursor = null;
      } while (noteCursor);
      expect(notes.size).toBe(count);
      expect((await memory.read(observer.accountId, {})).entries).toEqual([]);
      await withTransaction(pool, (c) =>
        service.configureObservation(
          c,
          owner.accountId,
          { peerKingdomId: first.kingdomId, observerKingdomId: observer.kingdomId, enabled: false, expectedVersion: 1 },
          100001,
        ),
      );
      expect(await council.history.observed(observer.accountId, owner.kingdomId, first.kingdomId)).toBeNull();
      const privacy = new PrivacyService(pool, {
        productScope: "pact",
        clock: { now: () => new Date("2027-02-01T12:00:00Z") },
        ownedData: [memory.retention, service.retention, council.history.retention],
      });
      await privacy.runRetention();
      expect((await council.thread(owner.accountId, first.kingdomId)).messages).toEqual([]);
      expect((await memory.read(owner.accountId, {})).entries.length).toBeGreaterThan(0);
      latency.sort((a, b) => a - b);
      const p95 = latency[Math.ceil(latency.length * 0.95) - 1];
      console.log(
        JSON.stringify({
          fixture: "society-load",
          relationships: count,
          reads: latency.length,
          p95Ms: Number(p95?.toFixed(3)),
          maxMs: Number(latency.at(-1)?.toFixed(3)),
          actualModelRequests: 0,
        }),
      );
    });
});
