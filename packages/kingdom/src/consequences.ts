import type { PoolClient } from "pg";
import { type FirstRetainedMilestones, readFirstRetainedMilestones } from "./keepsakes.js";
import type { SupplyFlow } from "./supply-terms.js";

export interface GameConsequences {
  asOfGameTimeMs: number;
  limit: number;
  firstRetained: FirstRetainedMilestones;
  builds: {
    id: string;
    building: string;
    targetLevel: number;
    state: string;
    remainingGameMinutes?: number | null;
    dueGameTimeMs: number | null;
    settledGameTimeMs: number | null;
  }[];
  contacts: { kingdomId: string; handle: string; displayName: string; acceptedGameTimeMs: string }[];
  supplyContracts: {
    id: string;
    offerId: string;
    offerVersion: number;
    youSend?: SupplyFlow | null;
    youReceive?: SupplyFlow | null;
    status: string;
    counterparty: { kingdomId: string; handle: string; displayName: string };
    remainingGameMinutes?: number;
    endGameTimeMs: number;
    noticeEndGameTimeMs: number | null;
    closeReason: string | null;
    signedBy: string[];
    deliveries: {
      resource: string;
      direction: string;
      installments: number;
      dueMarked: string;
      deliveredMarked: string;
      overflowMarked: string;
      failedInstallments: number;
      lastGameTimeMs: number;
    }[];
  }[];
}

/** Called only inside an already-authorized owner projection's repeatable-read snapshot. */
export async function readGameConsequences(
  client: PoolClient,
  scope: string,
  kingdomId: string,
  gameTimeMs: number,
): Promise<GameConsequences> {
  const builds = await client.query<{
    id: string;
    building: string;
    targetLevel: number;
    state: string;
    dueGameTimeMs: number | null;
    settledGameTimeMs: number | null;
  }>(
    `SELECT id, building_kind AS building, target_level AS "targetLevel", state,
     due_game_time_ms::float8 AS "dueGameTimeMs", settled_game_time_ms::float8 AS "settledGameTimeMs"
     FROM building_instructions WHERE product_scope=$1 AND kingdom_id=$2
     ORDER BY queued_game_time_ms DESC,id DESC LIMIT 20`,
    [scope, kingdomId],
  );
  const contacts = await client.query<GameConsequences["contacts"][number]>(
    `SELECT k.id AS "kingdomId",k.handle,k.display_name AS "displayName",c.accepted_game_time_ms::text AS "acceptedGameTimeMs"
     FROM social_contacts c JOIN kingdoms k ON k.product_scope=c.product_scope AND k.id=CASE WHEN c.kingdom_a=$2 THEN c.kingdom_b ELSE c.kingdom_a END
     WHERE c.product_scope=$1 AND (c.kingdom_a=$2 OR c.kingdom_b=$2)
     ORDER BY c.accepted_game_time_ms DESC,k.id DESC LIMIT 20`,
    [scope, kingdomId],
  );
  const contracts = await client.query<GameConsequences["supplyContracts"][number]>(
    `SELECT c.id,c.offer_id AS "offerId",c.offer_version AS "offerVersion",c.status,
     CASE WHEN c.kingdom_a=$2 THEN c.terms->'aToB' ELSE c.terms->'bToA' END AS "youSend",
     CASE WHEN c.kingdom_a=$2 THEN c.terms->'bToA' ELSE c.terms->'aToB' END AS "youReceive",
     jsonb_build_object('kingdomId',k.id,'handle',k.handle,'displayName',k.display_name) AS counterparty,
     c.end_game_time_ms::float8 AS "endGameTimeMs",c.notice_end_game_time_ms::float8 AS "noticeEndGameTimeMs",c.close_reason AS "closeReason",
     ARRAY(SELECT s.kingdom_id::text FROM supply_offer_signatures s WHERE s.product_scope=c.product_scope AND s.offer_id=c.offer_id AND s.version=c.offer_version ORDER BY s.kingdom_id) AS "signedBy",
     COALESCE((SELECT jsonb_agg(t) FROM (
       SELECT resource,CASE WHEN payer_kingdom_id=$2 THEN 'sent' ELSE 'received' END AS direction,
        count(*)::int AS installments,sum(due_units)::text AS "dueMarked",sum(delivered_units)::text AS "deliveredMarked",
        sum(overflow_units)::text AS "overflowMarked",count(*) FILTER(WHERE failure_reason IS NOT NULL)::int AS "failedInstallments",
        max(game_time_ms)::float8 AS "lastGameTimeMs"
       FROM supply_installments i WHERE i.product_scope=c.product_scope AND i.contract_id=c.id
       GROUP BY payer_kingdom_id,resource ORDER BY payer_kingdom_id,resource
     ) t),'[]'::jsonb) AS deliveries
     FROM supply_contracts c JOIN kingdoms k ON k.product_scope=c.product_scope AND k.id=CASE WHEN c.kingdom_a=$2 THEN c.kingdom_b ELSE c.kingdom_a END
     WHERE c.product_scope=$1 AND (c.kingdom_a=$2 OR c.kingdom_b=$2)
     ORDER BY c.start_game_time_ms DESC,c.id DESC LIMIT 20`,
    [scope, kingdomId],
  );
  return {
    asOfGameTimeMs: gameTimeMs,
    limit: 20,
    firstRetained: await readFirstRetainedMilestones(client, scope, kingdomId),
    builds: builds.rows.map((build) => ({
      ...build,
      remainingGameMinutes:
        build.dueGameTimeMs === null ? null : Math.max(0, Math.ceil((build.dueGameTimeMs - gameTimeMs) / 60_000)),
    })),
    contacts: contacts.rows,
    supplyContracts: contracts.rows.map((contract) => ({
      ...contract,
      remainingGameMinutes:
        contract.status === "active" ? Math.max(0, Math.ceil((contract.endGameTimeMs - gameTimeMs) / 60_000)) : 0,
    })),
  };
}
