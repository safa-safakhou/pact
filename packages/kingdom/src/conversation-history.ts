import { INTERNAL_UNITS_PER_RESOURCE } from "@pact/domain";
import type { Pool, PoolClient } from "pg";

const pairCondition = (a: string, b: string) => `((${a}=$2 AND ${b}=$3) OR (${a}=$3 AND ${b}=$2))`;
/** Participant records, or a currently mutually-consented named observer. Never acknowledges messages. */
export class ConversationHistoryReader {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
  ) {}
  readonly retention = {
    name: "conversationHistory",
    forgetAccount: async (client: PoolClient, accountId: string) => {
      await client.query(
        "UPDATE supply_offer_versions SET proposed_by=NULL WHERE product_scope=$1 AND proposed_by IN(SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2)",
        [this.scope, accountId],
      );
    },
    exportAccount: async (client: PoolClient, accountId: string) =>
      (
        await client.query(
          `SELECT v.* FROM supply_offer_versions v JOIN supply_offers o ON o.id=v.offer_id AND o.product_scope=v.product_scope JOIN kingdoms k ON k.product_scope=o.product_scope AND k.id=ANY(ARRAY[o.kingdom_a,o.kingdom_b]) WHERE v.product_scope=$1 AND k.account_id=$2 ORDER BY v.offer_id,v.version`,
          [this.scope, accountId],
        )
      ).rows,
    prune: async () => 0,
  };
  private async owner(accountId: string) {
    return (
      await this.pool.query<{ id: string }>(
        "SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2 AND status='ranked'",
        [this.scope, accountId],
      )
    ).rows[0]?.id;
  }
  private readonly observationGate = `FROM conversation_observation_consents a
    JOIN conversation_observation_consents b ON b.product_scope=a.product_scope AND b.kingdom_id=a.peer_kingdom_id AND b.peer_kingdom_id=a.kingdom_id AND b.observer_kingdom_id=a.observer_kingdom_id
    JOIN kingdoms x ON x.product_scope=a.product_scope AND x.id=a.kingdom_id AND x.status='ranked'
    JOIN kingdoms y ON y.product_scope=a.product_scope AND y.id=a.peer_kingdom_id AND y.status='ranked'
    WHERE a.product_scope=$1 AND a.observer_kingdom_id=$2 AND a.enabled AND b.enabled AND a.kingdom_id<a.peer_kingdom_id
    AND NOT EXISTS(SELECT 1 FROM social_blocks s WHERE s.product_scope=a.product_scope AND
      ((s.blocker_kingdom_id=ANY(ARRAY[a.kingdom_id,a.peer_kingdom_id,a.observer_kingdom_id]) AND s.blocked_kingdom_id=ANY(ARRAY[a.kingdom_id,a.peer_kingdom_id,a.observer_kingdom_id]))))`;
  async observationAccess(accountId: string, left: string, right: string) {
    const observer = await this.owner(accountId);
    if (!observer) return false;
    const [a, b] = [left, right].sort();
    return Boolean(
      (
        await this.pool.query(`SELECT 1 ${this.observationGate} AND a.kingdom_id=$3 AND a.peer_kingdom_id=$4`, [
          this.scope,
          observer,
          a,
          b,
        ])
      ).rowCount,
    );
  }
  async observations(accountId: string, offset = 0) {
    const observer = await this.owner(accountId);
    if (!observer) return { pairs: [], nextOffset: null };
    const rows = (
      await this.pool.query(
        `SELECT x.id AS "leftKingdomId",x.handle AS "leftHandle",x.display_name AS "leftName",y.id AS "rightKingdomId",y.handle AS "rightHandle",y.display_name AS "rightName" ${this.observationGate} ORDER BY x.id,y.id LIMIT 21 OFFSET $3`,
        [this.scope, observer, offset],
      )
    ).rows;
    return {
      pairs: rows.slice(0, 20),
      nextOffset: rows.length > 20 ? offset + 20 : null,
      consentMeaning:
        "Both participants currently authorize this named observer to read their retained and future exchange. Revocation blocks subsequent reads; already delivered content cannot be recalled.",
    };
  }
  async consents(accountId: string, peerId: string) {
    const owner = await this.owner(accountId);
    if (!owner) return [];
    return (
      await this.pool.query(
        `SELECT c.observer_kingdom_id AS "observerKingdomId",k.handle,k.display_name AS "displayName",c.enabled,c.version,
      EXISTS(SELECT 1 FROM conversation_observation_consents p WHERE p.product_scope=c.product_scope AND p.kingdom_id=c.peer_kingdom_id AND p.peer_kingdom_id=c.kingdom_id AND p.observer_kingdom_id=c.observer_kingdom_id AND p.enabled) AS "peerEnabled"
      FROM conversation_observation_consents c JOIN kingdoms k ON k.id=c.observer_kingdom_id AND k.product_scope=c.product_scope
      WHERE c.product_scope=$1 AND c.kingdom_id=$2 AND c.peer_kingdom_id=$3 ORDER BY c.observer_kingdom_id`,
        [this.scope, owner, peerId],
      )
    ).rows;
  }
  async agreements(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }) {
    const owner = await this.owner(accountId);
    if (!owner) return { offers: [], next: null, markedUnitsPerWhole: INTERNAL_UNITS_PER_RESOURCE.toString() };
    return this.agreementPair(owner, peerId, before);
  }
  private async agreementPair(left: string, right: string, before?: { gameTimeMs: string; id: string }) {
    const args = [this.scope, left, right, before?.gameTimeMs ?? null, before?.id ?? null];
    const supply = (
      await this.pool.query(
        `SELECT o.id,'supply' AS kind,o.version,CASE WHEN o.status='open' AND o.expires_game_time_ms<=COALESCE((SELECT committed_game_time_ms FROM world_clocks WHERE product_scope=$1),0) THEN 'expired' ELSE o.status END AS status,o.terms,o.updated_game_time_ms::text AS "gameTimeMs",o.expires_game_time_ms::text AS "expiresGameTimeMs",o.kingdom_a AS "leftKingdomId",o.kingdom_b AS "rightKingdomId"
      FROM supply_offers o WHERE o.product_scope=$1 AND ${pairCondition("o.kingdom_a", "o.kingdom_b")} AND ($4::bigint IS NULL OR (o.updated_game_time_ms,o.id)<($4::bigint,$5::uuid)) ORDER BY o.updated_game_time_ms DESC,o.id DESC LIMIT 11`,
        args,
      )
    ).rows;
    const garrison = (
      await this.pool.query(
        `SELECT o.id,'garrison' AS kind,o.version,CASE WHEN o.status='open' AND o.expires_game_time_ms<=COALESCE((SELECT committed_game_time_ms FROM world_clocks WHERE product_scope=$1),0) THEN 'expired' ELSE o.status END AS status,o.terms,o.created_game_time_ms::text AS "gameTimeMs",o.expires_game_time_ms::text AS "expiresGameTimeMs",o.lender_kingdom_id AS "leftKingdomId",o.host_kingdom_id AS "rightKingdomId"
      FROM garrison_offers o WHERE o.product_scope=$1 AND ${pairCondition("o.lender_kingdom_id", "o.host_kingdom_id")} AND ($4::bigint IS NULL OR (o.created_game_time_ms,o.id)<($4::bigint,$5::uuid)) ORDER BY o.created_game_time_ms DESC,o.id DESC LIMIT 11`,
        args,
      )
    ).rows;
    const rows = [...supply, ...garrison].sort(
      (a, b) => Number(b.gameTimeMs) - Number(a.gameTimeMs) || b.id.localeCompare(a.id),
    );
    const page = rows.slice(0, 10);
    const offers = await Promise.all(
      page.map(async (o) => {
        const versions =
          o.kind === "supply"
            ? (
                await this.pool.query(
                  `SELECT version,terms,expires_game_time_ms::text AS "expiresGameTimeMs",observed_game_time_ms::text AS "gameTimeMs",proposed_by AS "proposedBy",historical_baseline AS "historicalBaseline" FROM supply_offer_versions WHERE product_scope=$1 AND offer_id=$2 ORDER BY version DESC LIMIT 21`,
                  [this.scope, o.id],
                )
              ).rows
            : [
                {
                  version: o.version,
                  terms: o.terms,
                  gameTimeMs: o.gameTimeMs,
                  proposedBy: o.leftKingdomId,
                  historicalBaseline: false,
                },
              ];
        const signatures = (
          await this.pool.query(
            `SELECT version,kingdom_id AS "kingdomId",actor_kind AS "actorKind",signed_game_time_ms::text AS "gameTimeMs" FROM ${o.kind === "supply" ? "supply" : "garrison"}_offer_signatures WHERE product_scope=$1 AND offer_id=$2 AND version=ANY($3::int[]) ORDER BY version,signed_game_time_ms,kingdom_id`,
            [this.scope, o.id, versions.slice(0, 20).map((v) => v.version)],
          )
        ).rows;
        const contract =
          (
            await this.pool.query(
              o.kind === "supply"
                ? `SELECT id,status,start_game_time_ms::text AS "startGameTimeMs",end_game_time_ms::text AS "endGameTimeMs",notice_end_game_time_ms::text AS "noticeEndGameTimeMs",notice_by AS "noticeBy",close_reason AS "closeReason",closed_game_time_ms::text AS "closedGameTimeMs" FROM supply_contracts WHERE product_scope=$1 AND offer_id=$2`
                : `SELECT id,status,start_game_time_ms::text AS "startGameTimeMs",end_game_time_ms::text AS "endGameTimeMs",exit_requested_game_time_ms::text AS "exitRequestedGameTimeMs",close_reason AS "closeReason",closed_game_time_ms::text AS "closedGameTimeMs",lender_default AS "lenderDefault",host_default AS "hostDefault" FROM garrison_contracts WHERE product_scope=$1 AND offer_id=$2`,
              [this.scope, o.id],
            )
          ).rows[0] ?? null;
        const deliveries =
          contract && o.kind === "supply"
            ? (
                await this.pool.query(
                  `SELECT payer_kingdom_id AS "payerKingdomId",recipient_kingdom_id AS "recipientKingdomId",resource,sum(due_units)::text AS "dueMarkedUnits",sum(delivered_units)::text AS "deliveredMarkedUnits",sum(overflow_units)::text AS "overflowMarkedUnits",count(*)::int AS installments,count(*) FILTER(WHERE failure_reason IS NOT NULL)::int AS "failedInstallments",min(game_time_ms)::text AS "firstGameTimeMs",max(game_time_ms)::text AS "lastGameTimeMs" FROM supply_installments WHERE product_scope=$1 AND contract_id=$2 GROUP BY payer_kingdom_id,recipient_kingdom_id,resource`,
                  [this.scope, contract.id],
                )
              ).rows
            : [];
        return {
          ...o,
          signatures,
          versions: versions.slice(0, 20),
          versionsNextBefore: versions.length > 20 ? versions[19]?.version : null,
          contract,
          deliveries,
        };
      }),
    );
    const last = page.at(-1);
    return {
      offers,
      next: rows.length > 10 && last ? { gameTimeMs: last.gameTimeMs, id: last.id } : null,
      historyMeaning:
        "Only retained engine versions are facts. Earlier overwritten terms are unavailable. Signatures on older versions do not sign current terms.",
      markedUnitsPerWhole: INTERNAL_UNITS_PER_RESOURCE.toString(),
    };
  }
  async versions(accountId: string, peerId: string, offerId: string, beforeVersion: number) {
    const owner = await this.owner(accountId);
    if (!owner) return { versions: [], signatures: [], nextBefore: null };
    const versions = (
      await this.pool.query(
        `SELECT v.version,v.terms,v.expires_game_time_ms::text AS "expiresGameTimeMs",v.observed_game_time_ms::text AS "gameTimeMs",v.proposed_by AS "proposedBy",v.historical_baseline AS "historicalBaseline" FROM supply_offer_versions v JOIN supply_offers o ON o.id=v.offer_id AND o.product_scope=v.product_scope WHERE v.product_scope=$1 AND ${pairCondition("o.kingdom_a", "o.kingdom_b")} AND v.offer_id=$4 AND v.version<$5 ORDER BY v.version DESC LIMIT 21`,
        [this.scope, owner, peerId, offerId, beforeVersion],
      )
    ).rows;
    const page = versions.slice(0, 20);
    const signatures = (
      await this.pool.query(
        `SELECT version,kingdom_id AS "kingdomId",actor_kind AS "actorKind",signed_game_time_ms::text AS "gameTimeMs" FROM supply_offer_signatures WHERE product_scope=$1 AND offer_id=$2 AND version=ANY($3::int[]) ORDER BY version,signed_game_time_ms,kingdom_id`,
        [this.scope, offerId, page.map((v) => v.version)],
      )
    ).rows;
    return { versions: page, signatures, nextBefore: versions.length > 20 ? page.at(-1)?.version : null };
  }
  async observed(accountId: string, left: string, right: string, before?: { gameTimeMs: string; id: string }) {
    if (!(await this.observationAccess(accountId, left, right))) return null;
    // The consent gate is in the same statement as the content selection to honor committed revocation.
    const observer = await this.owner(accountId),
      [a, b] = [left, right].sort();
    const rows = (
      await this.pool.query(
        `SELECT m.id,m.sender_kingdom_id AS "senderKingdomId",m.body,m.agent_originated AS "agentOriginated",m.sent_game_time_ms::text AS "sentGameTimeMs" FROM direct_messages m WHERE m.product_scope=$1 AND ${pairCondition("m.sender_kingdom_id", "m.recipient_kingdom_id")} AND ($4::bigint IS NULL OR (m.sent_game_time_ms,m.id)<($4::bigint,$5::uuid)) AND EXISTS(SELECT 1 ${this.observationGate.replaceAll("$2", "$6")} AND a.kingdom_id=$7 AND a.peer_kingdom_id=$8) ORDER BY m.sent_game_time_ms DESC,m.id DESC LIMIT 41`,
        [this.scope, left, right, before?.gameTimeMs ?? null, before?.id ?? null, observer, a, b],
      )
    ).rows;
    const page: typeof rows = [];
    let bytes = 512;
    for (const row of rows.slice(0, 40)) {
      const size = Buffer.byteLength(JSON.stringify(row)) + 128;
      if (bytes + size > 64000) break;
      page.push(row);
      bytes += size;
    }
    const oldest = page.at(-1);
    return {
      messages: page.reverse(),
      next: rows.length > page.length && oldest ? { gameTimeMs: oldest.sentGameTimeMs, id: oldest.id } : null,
      readOnly: true,
      untrustedContent: true,
    };
  }
}
