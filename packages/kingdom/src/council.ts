import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { ConversationHistoryReader } from "./conversation-history.js";
import { acknowledgeMessageRead } from "./message-read-state.js";
import type { SocialOverviewReader } from "./social-overview.js";

export interface EnvoyCharacter {
  name: string;
  seed: string;
  color: string;
  variation: number;
}
export interface CouncilActivity {
  lastObservedAt: string | null;
  runActive: boolean;
}
export function generatedEnvoy(id: string): EnvoyCharacter {
  const digest = createHash("sha256").update(id).digest();
  const names = ["Rowan", "Aster", "Iona", "Sera", "Orrin", "Maren", "Ash", "River", "Ember", "Wren"];
  const colors = ["#53796a", "#a5674d", "#6c8194", "#85718e", "#8b894f"];
  return {
    name: names[(digest[0] ?? 0) % names.length] ?? "Envoy",
    seed: id,
    color: colors[(digest[1] ?? 0) % colors.length] ?? "#53796a",
    variation: 0,
  };
}
/** The owner participates in every returned exchange. No model call or inferred reply/approval. */
export class CouncilReader {
  readonly history: ConversationHistoryReader;
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly social: SocialOverviewReader,
    private readonly activity: (accountIds: string[]) => Promise<Record<string, CouncilActivity>>,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.history = new ConversationHistoryReader(pool, scope);
  }

  async read(accountId: string, publicIds: string[] = [], observeHuman = false) {
    const interactions = await this.social.read(accountId, { acknowledgeDeliveredMessages: false });
    if (!interactions) return null;
    if (observeHuman)
      await this.pool.query(
        "UPDATE kingdoms SET ruler_observed_at=$3 WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
        [this.scope, accountId, this.now()],
      );
    const ids = new Set([interactions.kingdomId, ...publicIds]);
    for (const list of [
      interactions.contacts,
      interactions.requests,
      interactions.messages,
      interactions.supplyOffers,
      interactions.supplyContracts,
      interactions.garrisonOffers,
      interactions.garrisonContracts,
    ])
      for (const item of list) ids.add(item.kingdomId);
    const rows = (
      await this.pool.query<{
        id: string;
        account_id: string;
        envoy_character: EnvoyCharacter | null;
        envoy_character_version: number;
        ruler_observed_at: Date | null;
      }>(
        "SELECT id,account_id,envoy_character,envoy_character_version,ruler_observed_at FROM kingdoms WHERE product_scope=$1 AND id=ANY($2::uuid[]) AND status='ranked'",
        [this.scope, [...ids]],
      )
    ).rows;
    const activity = await this.activity(rows.map((r) => r.account_id));
    const parties = Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          character: r.envoy_character ?? generatedEnvoy(r.id),
          characterVersion: r.envoy_character_version,
          agent: activity[r.account_id] ?? { lastObservedAt: null, runActive: false },
          ruler: { lastObservedAt: r.ruler_observed_at?.toISOString() ?? null },
        },
      ]),
    );
    return {
      interactions,
      parties,
      observedAt: this.now().toISOString(),
      presenceMeaning:
        "Recent contact with PACT is an observation, not a persistent connection or guarantee of a reply. Ruler and agent activity are separate. Other rulers' approval state is private.",
      bounded: true,
    };
  }

  readonly retention = {
    name: "kingdomCouncil",
    forgetAccount: async (client: import("pg").PoolClient, accountId: string) => {
      await client.query(
        "UPDATE kingdoms SET envoy_character=NULL,ruler_observed_at=NULL WHERE product_scope=$1 AND account_id=$2",
        [this.scope, accountId],
      );
    },
    exportAccount: async (client: import("pg").PoolClient, accountId: string) =>
      (
        await client.query(
          "SELECT envoy_character,envoy_character_version,ruler_observed_at FROM kingdoms WHERE product_scope=$1 AND account_id=$2",
          [this.scope, accountId],
        )
      ).rows,
    prune: async (client: import("pg").PoolClient, now: Date) =>
      (
        await client.query(
          "UPDATE kingdoms SET ruler_observed_at=NULL WHERE product_scope=$1 AND ruler_observed_at<$2",
          [this.scope, new Date(now.getTime() - 30 * 86400000)],
        )
      ).rowCount ?? 0,
  };

  async customize(accountId: string, character: EnvoyCharacter, expectedVersion: number) {
    const result = await this.pool.query<{ envoy_character_version: number }>(
      `UPDATE kingdoms SET envoy_character=$3,envoy_character_version=envoy_character_version+1
       WHERE product_scope=$1 AND account_id=$2 AND status='ranked' AND envoy_character_version=$4 RETURNING envoy_character_version`,
      [this.scope, accountId, character, expectedVersion],
    );
    return result.rows[0] ? { character, version: result.rows[0].envoy_character_version } : null;
  }

  async thread(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }) {
    const rows = await this.pool.query<{
      owner_kingdom_id: string;
      id: string;
      sender_kingdom_id: string;
      agent_originated: boolean;
      body: string;
      sent_game_time_ms: string;
    }>(
      `SELECT k.id AS owner_kingdom_id,m.id,m.sender_kingdom_id,m.agent_originated,m.body,m.sent_game_time_ms::text FROM kingdoms k
       JOIN direct_messages m ON m.product_scope=k.product_scope AND (m.sender_kingdom_id=k.id OR m.recipient_kingdom_id=k.id)
       WHERE k.product_scope=$1 AND k.account_id=$2 AND k.status='ranked'
       AND (CASE WHEN m.sender_kingdom_id=k.id THEN m.recipient_kingdom_id ELSE m.sender_kingdom_id END)=$3
       AND ($4::bigint IS NULL OR (m.sent_game_time_ms,m.id)<($4::bigint,$5::uuid))
       ORDER BY m.sent_game_time_ms DESC,m.id DESC LIMIT 41`,
      [this.scope, accountId, peerId, before?.gameTimeMs ?? null, before?.id ?? null],
    );
    // Full text is delivered or left unread. Bound serialized bytes, including escaping.
    const page: typeof rows.rows = [];
    let bytes = 256;
    for (const row of rows.rows.slice(0, 40)) {
      const size = Buffer.byteLength(JSON.stringify(row), "utf8") + 256;
      if (bytes + size > 64000) break;
      page.push(row);
      bytes += size;
    }
    const ownerId = page[0]?.owner_kingdom_id;
    if (ownerId)
      await acknowledgeMessageRead(
        this.pool,
        this.scope,
        ownerId,
        page.filter((row) => row.sender_kingdom_id !== ownerId).map((row) => row.id),
      );
    const oldest = page.at(-1);
    return {
      messages: page.reverse().map((r) => ({
        id: r.id,
        senderKingdomId: r.sender_kingdom_id,
        authorKind: r.agent_originated ? "agent" : "human",
        body: r.body,
        sentGameTimeMs: r.sent_game_time_ms,
      })),
      next: rows.rows.length > page.length && oldest ? { gameTimeMs: oldest.sent_game_time_ms, id: oldest.id } : null,
      untrustedContent: true,
    };
  }
}
