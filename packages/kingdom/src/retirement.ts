import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import type { ResourceLedger } from "@pact/ledger";
import type { WorldClockService } from "@pact/world";
import type { PoolClient } from "pg";
import type { BuildingEngine } from "./buildings.js";
import type { GarrisonService } from "./garrison.js";
import type { SupplyService } from "./supply.js";
import type { SupplySettlementService } from "./supply-settlement.js";
import type { TroopService } from "./troops.js";

/** Game-side deletion hook. Identity erasure stays on a separate real-time clock. */
export class KingdomRetirementService {
  constructor(
    private readonly productScope: string,
    private readonly world: WorldClockService,
    private readonly ledger: ResourceLedger,
    private readonly supply: SupplyService,
    private readonly settlement: SupplySettlementService,
    private readonly garrison: GarrisonService,
    private readonly buildings: BuildingEngine,
    private readonly troops: TroopService,
  ) {}

  async begin(client: PoolClient, accountId: string): Promise<void> {
    const found = await client.query<{ id: string; status: string }>(
      "SELECT id, status FROM kingdoms WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, accountId],
    );
    const kingdom = found.rows[0];
    if (!kingdom || kingdom.status === "retired") return;
    const gameTimeMs = (await this.world.read()).gameTimeMs;
    if (kingdom.status === "ranked") {
      const instructions = await client.query<{ id: string }>(
        `SELECT id FROM building_instructions WHERE product_scope = $1 AND kingdom_id = $2
         AND state IN ('waiting', 'active') ORDER BY id`,
        [this.productScope, kingdom.id],
      );
      for (const instruction of instructions.rows)
        await this.buildings.cancel(client, {
          accountId,
          kingdomId: kingdom.id,
          instructionId: instruction.id,
          gameTimeMs,
        });
      const batches = await client.query<{ id: string }>(
        `SELECT id FROM training_batches WHERE product_scope = $1 AND kingdom_id = $2
         AND status = 'active' ORDER BY id`,
        [this.productScope, kingdom.id],
      );
      for (const batch of batches.rows)
        await this.troops.cancelTraining(client, {
          accountId,
          kingdomId: kingdom.id,
          batchId: batch.id,
          gameTimeMs,
        });
      const offers = await client.query<{ id: string }>(
        `SELECT id FROM supply_offers WHERE product_scope = $1 AND status = 'open'
         AND (kingdom_a = $2 OR kingdom_b = $2) ORDER BY id`,
        [this.productScope, kingdom.id],
      );
      for (const offer of offers.rows) await this.supply.withdrawOffer(client, accountId, offer.id, gameTimeMs);
    }
    const garrisonOffers = await client.query<{ id: string }>(
      `SELECT id FROM garrison_offers WHERE product_scope = $1 AND status = 'open'
       AND (lender_kingdom_id = $2 OR host_kingdom_id = $2) ORDER BY id`,
      [this.productScope, kingdom.id],
    );
    for (const offer of garrisonOffers.rows)
      await this.garrison.withdrawOffer(client, { accountId, offerId: offer.id, gameTimeMs });
    await this.settlement.defaultForRetirement(client, kingdom.id, gameTimeMs);
    const contracts = await client.query<{ id: string }>(
      `SELECT id FROM garrison_contracts WHERE product_scope = $1 AND status <> 'closed'
       AND (lender_kingdom_id = $2 OR host_kingdom_id = $2) ORDER BY id`,
      [this.productScope, kingdom.id],
    );
    for (const contract of contracts.rows)
      await this.garrison.requestExit(client, { accountId, contractId: contract.id, gameTimeMs });
    await client.query(
      `DELETE FROM direct_contact_invitations WHERE product_scope = $1
       AND (issuer_kingdom_id = $2 OR redeemed_by_kingdom_id = $2)`,
      [this.productScope, kingdom.id],
    );
    await client.query(`DELETE FROM social_contacts WHERE product_scope = $1 AND (kingdom_a = $2 OR kingdom_b = $2)`, [
      this.productScope,
      kingdom.id,
    ]);
    await client.query(
      `DELETE FROM social_blocks WHERE product_scope = $1
       AND (blocker_kingdom_id = $2 OR blocked_kingdom_id = $2)`,
      [this.productScope, kingdom.id],
    );
    await client.query(
      `DELETE FROM social_mutes WHERE product_scope = $1
       AND (muter_kingdom_id = $2 OR muted_kingdom_id = $2)`,
      [this.productScope, kingdom.id],
    );
    const changed = await client.query(
      `UPDATE kingdoms SET status = 'closing', draft_id = NULL,
         handle = 'retired_' || left(replace(id::text, '-', ''), 16),
         display_name = 'Retired kingdom', portrait = 'portrait.wolf'
       WHERE product_scope = $1 AND id = $2 AND status = 'ranked'`,
      [this.productScope, kingdom.id],
    );
    if (changed.rowCount)
      await appendOutbox(client, {
        productScope: this.productScope,
        eventId: randomUUID(),
        type: "kingdom.closing.v1",
        payload: { kingdomId: kingdom.id, gameTimeMs },
      });
  }

  /** Remove authored prose without deleting another player's economic or message tombstone. */
  async eraseIdentity(client: PoolClient, accountId: string): Promise<void> {
    const found = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, accountId],
    );
    const kingdomId = found.rows[0]?.id;
    if (!kingdomId) return;
    await client.query(
      `UPDATE direct_messages SET body = '[deleted]'
       WHERE product_scope = $1 AND sender_kingdom_id = $2`,
      [this.productScope, kingdomId],
    );
    await client.query(
      `UPDATE cold_contact_requests SET note = '[deleted]'
       WHERE product_scope = $1 AND sender_kingdom_id = $2`,
      [this.productScope, kingdomId],
    );
    await client.query(
      `UPDATE outbox_events SET payload =
         CASE WHEN payload ? 'handle' THEN jsonb_set(payload, '{handle}', to_jsonb($3::text)) ELSE payload END
       WHERE product_scope = $1 AND payload->>'kingdomId' = $2`,
      [this.productScope, kingdomId, `retired_${kingdomId.replaceAll("-", "").slice(0, 16)}`],
    );
  }

  /** Real-time audit-window cleanup, independent of the game clock. */
  async pruneHistory(client: PoolClient, before: Date): Promise<number> {
    const kingdoms = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND status = 'retired' ORDER BY id",
      [this.productScope],
    );
    let removed = 0;
    for (const kingdom of kingdoms.rows) removed += await this.ledger.pruneMovementHistory(client, kingdom.id, before);
    return removed;
  }

  /** Drop the last pseudonymous checkpoint only after its audit window and references end. */
  async pruneKingdoms(client: PoolClient, before: Date): Promise<number> {
    const result = await client.query(
      `DELETE FROM kingdoms k WHERE k.product_scope = $1 AND k.status = 'retired'
       AND k.retired_at <= $2
       AND NOT EXISTS (SELECT 1 FROM raids r WHERE r.product_scope = $1
         AND (r.leader_kingdom_id = k.id OR r.target_kingdom_id = k.id))
       AND NOT EXISTS (SELECT 1 FROM scout_operations s WHERE s.product_scope = $1
         AND (s.scout_kingdom_id = k.id OR s.target_kingdom_id = k.id))
       AND NOT EXISTS (SELECT 1 FROM garrison_offers o WHERE o.product_scope = $1
         AND (o.lender_kingdom_id = k.id OR o.host_kingdom_id = k.id))
       AND NOT EXISTS (SELECT 1 FROM garrison_contracts g WHERE g.product_scope = $1
         AND (g.lender_kingdom_id = k.id OR g.host_kingdom_id = k.id))
       AND NOT EXISTS (SELECT 1 FROM supply_offers o WHERE o.product_scope = $1
         AND (o.kingdom_a = k.id OR o.kingdom_b = k.id))
       AND NOT EXISTS (SELECT 1 FROM supply_contracts s WHERE s.product_scope = $1
         AND (s.kingdom_a = k.id OR s.kingdom_b = k.id))`,
      [this.productScope, before],
    );
    return result.rowCount ?? 0;
  }

  /** Invoke after accepted raid/scout and garrison settlement, never from the real-time purge job. */
  async retireDue(client: PoolClient, gameTimeMs: number): Promise<number> {
    const closing = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND status = 'closing' ORDER BY id FOR UPDATE",
      [this.productScope],
    );
    let retired = 0;
    for (const { id } of closing.rows) {
      const pending = await client.query(
        `SELECT 1 WHERE EXISTS (
           SELECT 1 FROM raids r WHERE r.product_scope = $1 AND r.status IN ('declared', 'locked')
             AND (r.leader_kingdom_id = $2 OR r.target_kingdom_id = $2
               OR EXISTS (SELECT 1 FROM raid_contributions c WHERE c.product_scope = $1
                 AND c.raid_id = r.id AND c.kingdom_id = $2 AND c.status = 'committed'))
         ) OR EXISTS (
           SELECT 1 FROM scout_operations s WHERE s.product_scope = $1 AND s.status = 'active'
             AND (s.scout_kingdom_id = $2 OR s.target_kingdom_id = $2)
         ) OR EXISTS (
           SELECT 1 FROM garrison_contracts g WHERE g.product_scope = $1 AND g.status <> 'closed'
             AND (g.lender_kingdom_id = $2 OR g.host_kingdom_id = $2)
         ) OR EXISTS (
           SELECT 1 FROM supply_contracts s WHERE s.product_scope = $1 AND s.status = 'active'
             AND (s.kingdom_a = $2 OR s.kingdom_b = $2)
         ) OR EXISTS (
           SELECT 1 FROM kingdom_troops t WHERE t.product_scope = $1
             AND (t.owner_kingdom_id = $2 OR t.host_kingdom_id = $2) AND t.placement <> 'home'
         )`,
        [this.productScope, id],
      );
      if (pending.rowCount) continue;
      const locked = await client.query(
        `SELECT 1 FROM resource_balances WHERE product_scope = $1 AND kingdom_id = $2
         AND locked_units <> 0 LIMIT 1`,
        [this.productScope, id],
      );
      if (locked.rowCount) continue;
      for (const resource of ["iron", "silver", "grain"] as const)
        await this.ledger.discardRetired(client, id, resource, gameTimeMs);
      await client.query("DELETE FROM kingdom_troops WHERE product_scope = $1 AND owner_kingdom_id = $2", [
        this.productScope,
        id,
      ]);
      await client.query("DELETE FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2", [
        this.productScope,
        id,
      ]);
      await client.query(
        "UPDATE kingdoms SET status = 'retired', retired_at = clock_timestamp() WHERE product_scope = $1 AND id = $2",
        [this.productScope, id],
      );
      await appendOutbox(client, {
        productScope: this.productScope,
        eventId: randomUUID(),
        type: "kingdom.retired.v1",
        payload: { kingdomId: id, gameTimeMs },
      });
      retired += 1;
    }
    return retired;
  }
}
