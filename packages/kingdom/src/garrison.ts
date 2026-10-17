import { randomUUID } from "node:crypto";
import { ExactHumanPermitService, type ExposureService } from "@pact/authority";
import { appendOutbox } from "@pact/db";
import { hourlyRatePerMinute, rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { PoolClient } from "pg";
import type { TroopKind, TroopService } from "./troops.js";

export type GarrisonResource = "iron" | "silver" | "grain";
export interface GarrisonBond {
  resource: GarrisonResource;
  wholeAmount: number;
}
export interface GarrisonTerms {
  units: readonly { type: TroopKind; count: number }[];
  durationHours: 1 | 6 | 24;
  lenderBond: GarrisonBond | null;
  hostBond: GarrisonBond | null;
}

interface OfferRow {
  id: string;
  lender_kingdom_id: string;
  host_kingdom_id: string;
  version: number;
  terms: GarrisonTerms;
  status: "open" | "active" | "withdrawn" | "expired";
  expires_game_time_ms: string;
}

interface SignatureRow {
  kingdom_id: string;
  actor_kind: "human" | "agent";
  authority_ref: string | null;
}

interface ContractRow {
  id: string;
  lender_kingdom_id: string;
  host_kingdom_id: string;
  terms: GarrisonTerms;
  status: "active" | "exit_pending" | "closed";
  end_game_time_ms: string;
  lender_default: boolean;
  host_default: boolean;
  lender_bond_units: string;
  host_bond_units: string;
  lender_authority_ref: string | null;
  host_authority_ref: string | null;
  close_reason: string | null;
}

export class GarrisonError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GarrisonError";
  }
}

function validateTerms(input: GarrisonTerms): GarrisonTerms {
  if (!rulesCatalog.garrison.durationHours.includes(input.durationHours)) throw new GarrisonError("INVALID_DURATION");
  if (input.units.length < 1 || input.units.length > 4) throw new GarrisonError("INVALID_UNITS");
  const seen = new Set<string>();
  for (const unit of input.units) {
    if (!Object.hasOwn(rulesCatalog.units, unit.type) || !Number.isSafeInteger(unit.count) || unit.count < 1)
      throw new GarrisonError("INVALID_UNITS");
    if (seen.has(unit.type)) throw new GarrisonError("INVALID_UNITS");
    seen.add(unit.type);
  }
  for (const bond of [input.lenderBond, input.hostBond]) {
    if (!bond) continue;
    if (
      !["iron", "silver", "grain"].includes(bond.resource) ||
      !Number.isSafeInteger(bond.wholeAmount) ||
      bond.wholeAmount < 1
    )
      throw new GarrisonError("INVALID_BOND");
    const recruitmentQuarterValue = input.units.reduce(
      (sum, unit) =>
        sum +
        BigInt(unit.count) *
          (4n * BigInt(rulesCatalog.units[unit.type].iron) + 8n * BigInt(rulesCatalog.units[unit.type].silver)),
      0n,
    );
    const bondQuarterValue =
      BigInt(bond.wholeAmount) * BigInt(bond.resource === "grain" ? 1 : bond.resource === "iron" ? 4 : 8);
    if (bondQuarterValue > recruitmentQuarterValue) throw new GarrisonError("BOND_TOO_LARGE");
  }
  return {
    units: [...input.units].sort((left, right) => left.type.localeCompare(right.type)),
    durationHours: input.durationHours,
    lenderBond: input.lenderBond,
    hostBond: input.hostBond,
  };
}

function upkeepExposure(terms: GarrisonTerms): bigint {
  const perMinute = terms.units.reduce(
    (sum, item) => sum + hourlyRatePerMinute(rulesCatalog.units[item.type].grainPerHour) * BigInt(item.count),
    0n,
  );
  return perMinute * BigInt(terms.durationHours * 60 + 5);
}

/** Transaction-bound garrison offers and contract lifecycle. */
export class GarrisonService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly troops: TroopService,
    private readonly exposure: ExposureService,
    private readonly humanPermits: ExactHumanPermitService = new ExactHumanPermitService(productScope),
  ) {}

  async expireOffers(client: PoolClient, gameTimeMs: number): Promise<number> {
    const expired = await client.query<{ id: string }>(
      `UPDATE garrison_offers SET status = 'expired', closed_at = clock_timestamp()
       WHERE product_scope = $1 AND status = 'open' AND expires_game_time_ms <= $2 RETURNING id`,
      [this.productScope, gameTimeMs],
    );
    for (const row of expired.rows) {
      const refs = await client.query<{ authority_ref: string | null }>(
        "SELECT authority_ref FROM garrison_offer_signatures WHERE product_scope = $1 AND offer_id = $2",
        [this.productScope, row.id],
      );
      for (const signature of refs.rows)
        if (signature.authority_ref) await this.exposure.release(client, signature.authority_ref, gameTimeMs);
      await this.emit(client, "garrison.offer.expired.v1", { offerId: row.id, gameTimeMs });
    }
    return expired.rows.length;
  }

  async withdrawOffer(
    client: PoolClient,
    input: { accountId: string; offerId: string; gameTimeMs: number },
  ): Promise<void> {
    const preview = await client.query<OfferRow>("SELECT * FROM garrison_offers WHERE id = $1 AND product_scope = $2", [
      input.offerId,
      this.productScope,
    ]);
    const offer = preview.rows[0];
    if (!offer) throw new GarrisonError("OFFER_NOT_FOUND");
    await this.lockPair(client, offer.lender_kingdom_id, offer.host_kingdom_id, true);
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, input.accountId],
    );
    if (owner.rows[0]?.id !== offer.lender_kingdom_id && owner.rows[0]?.id !== offer.host_kingdom_id)
      throw new GarrisonError("NOT_PARTY");
    const changed = await client.query(
      "UPDATE garrison_offers SET status = 'withdrawn', closed_at = clock_timestamp() WHERE id = $1 AND product_scope = $2 AND status = 'open'",
      [input.offerId, this.productScope],
    );
    if (changed.rowCount !== 1) throw new GarrisonError("OFFER_CLOSED");
    const refs = await client.query<{ authority_ref: string | null }>(
      "SELECT authority_ref FROM garrison_offer_signatures WHERE product_scope = $1 AND offer_id = $2",
      [this.productScope, input.offerId],
    );
    for (const signature of refs.rows)
      if (signature.authority_ref) await this.exposure.release(client, signature.authority_ref, input.gameTimeMs);
    await this.emit(client, "garrison.offer.withdrawn.v1", { offerId: input.offerId, gameTimeMs: input.gameTimeMs });
  }

  async createOffer(
    client: PoolClient,
    input: {
      accountId: string;
      hostKingdomId: string;
      offerId: string;
      terms: GarrisonTerms;
      gameTimeMs: number;
      expiresGameTimeMs: number;
    },
  ): Promise<string> {
    const terms = validateTerms(input.terms);
    if (
      !Number.isSafeInteger(input.gameTimeMs) ||
      !Number.isSafeInteger(input.expiresGameTimeMs) ||
      input.expiresGameTimeMs <= input.gameTimeMs
    )
      throw new GarrisonError("INVALID_EXPIRY");
    const lender = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, input.accountId],
    );
    const lenderId = lender.rows[0]?.id;
    if (!lenderId || lenderId === input.hostKingdomId) throw new GarrisonError("NOT_PARTY");
    await this.lockPair(client, lenderId, input.hostKingdomId);
    const hall = await client.query<{ level: number }>(
      "SELECT level FROM kingdom_buildings WHERE product_scope = $1 AND kingdom_id = $2 AND kind = 'hall'",
      [this.productScope, lenderId],
    );
    if ((hall.rows[0]?.level ?? 0) < rulesCatalog.garrison.minimumLenderHallLevel)
      throw new GarrisonError("HALL_LOCKED");
    const existing = await client.query<OfferRow>(
      "SELECT * FROM garrison_offers WHERE id = $1 AND product_scope = $2",
      [input.offerId, this.productScope],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (
        row.lender_kingdom_id !== lenderId ||
        row.host_kingdom_id !== input.hostKingdomId ||
        JSON.stringify(validateTerms(row.terms)) !== JSON.stringify(terms) ||
        Number(row.expires_game_time_ms) !== input.expiresGameTimeMs
      )
        throw new GarrisonError("OFFER_CONFLICT");
      return row.id;
    }
    await client.query(
      `INSERT INTO garrison_offers(id, product_scope, lender_kingdom_id, host_kingdom_id,
         terms, expires_game_time_ms, created_game_time_ms)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
      [
        input.offerId,
        this.productScope,
        lenderId,
        input.hostKingdomId,
        JSON.stringify(terms),
        input.expiresGameTimeMs,
        input.gameTimeMs,
      ],
    );
    await this.emit(client, "garrison.offer.created.v1", {
      offerId: input.offerId,
      gameTimeMs: input.gameTimeMs,
      lenderId,
      hostId: input.hostKingdomId,
    });
    return input.offerId;
  }

  async signOffer(
    client: PoolClient,
    input: {
      accountId: string;
      offerId: string;
      version: number;
      actorKind: "human" | "agent";
      permitId?: string;
      gameTimeMs: number;
    },
  ): Promise<{ contractId: string | null }> {
    if (input.actorKind === "agent" && input.permitId) throw new GarrisonError("PERMIT_NOT_AGENT_AUTHORITY");
    const preview = await client.query<OfferRow>("SELECT * FROM garrison_offers WHERE id = $1 AND product_scope = $2", [
      input.offerId,
      this.productScope,
    ]);
    const offer = preview.rows[0];
    if (!offer) throw new GarrisonError("OFFER_NOT_FOUND");
    await this.lockPair(client, offer.lender_kingdom_id, offer.host_kingdom_id);
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, input.accountId],
    );
    const kingdomId = owner.rows[0]?.id;
    if (kingdomId !== offer.lender_kingdom_id && kingdomId !== offer.host_kingdom_id)
      throw new GarrisonError("NOT_PARTY");
    const current = await client.query<OfferRow>("SELECT * FROM garrison_offers WHERE id = $1 FOR UPDATE", [offer.id]);
    const row = current.rows[0];
    if (!row || row.version !== input.version) throw new GarrisonError("STALE_VERSION");
    if (row.status === "active") {
      const signed = await client.query<SignatureRow>(
        "SELECT * FROM garrison_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3 AND kingdom_id = $4",
        [this.productScope, row.id, row.version, kingdomId],
      );
      if (signed.rows[0]?.actor_kind !== input.actorKind) throw new GarrisonError("SIGNATURE_CONFLICT");
      const contract = await client.query<{ id: string }>("SELECT id FROM garrison_contracts WHERE offer_id = $1", [
        row.id,
      ]);
      if (contract.rows[0]) return { contractId: contract.rows[0].id };
    }
    if (row.status !== "open" || Number(row.expires_game_time_ms) <= input.gameTimeMs)
      throw new GarrisonError("OFFER_CLOSED");
    const existing = await client.query<SignatureRow>(
      "SELECT * FROM garrison_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3 AND kingdom_id = $4",
      [this.productScope, row.id, row.version, kingdomId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].actor_kind !== input.actorKind) throw new GarrisonError("SIGNATURE_CONFLICT");
      return { contractId: null };
    }
    const terms = validateTerms(row.terms);
    const lender = kingdomId === row.lender_kingdom_id;
    const bond = lender ? terms.lenderBond : terms.hostBond;
    const assets: Record<string, bigint> = {};
    if (bond) assets[bond.resource] = wholeResources(bond.wholeAmount);
    if (!lender) assets.grain = (assets.grain ?? 0n) + upkeepExposure(terms);
    const troopCount = lender ? terms.units.reduce((sum, unit) => sum + unit.count, 0) : 0;
    const authorityRef =
      input.actorKind === "agent" || input.permitId
        ? await this.exposure.reserve(client, {
            accountId: input.accountId,
            operationKey: `garrison:${row.id}:${row.version}:${kingdomId}`,
            action: "garrison.sign",
            actor: input.actorKind === "agent" ? "agent" : "human_exception",
            assets,
            troopCount,
            gameTimeMs: input.gameTimeMs,
            ...(input.permitId ? { permitRef: input.permitId } : {}),
          })
        : null;
    await client.query(
      `INSERT INTO garrison_offer_signatures(product_scope, offer_id, version, kingdom_id,
         actor_kind, authority_ref, signed_game_time_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [this.productScope, row.id, row.version, kingdomId, input.actorKind, authorityRef, input.gameTimeMs],
    );
    const signatures = await client.query<SignatureRow>(
      "SELECT * FROM garrison_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3 ORDER BY kingdom_id",
      [this.productScope, row.id, row.version],
    );
    if (signatures.rows.length !== 2) return { contractId: null };
    return { contractId: await this.activate(client, row, terms, signatures.rows, input.gameTimeMs) };
  }

  private async activate(
    client: PoolClient,
    offer: OfferRow,
    terms: GarrisonTerms,
    signatures: SignatureRow[],
    gameTimeMs: number,
  ): Promise<string> {
    const lenderCount = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM garrison_contracts WHERE product_scope = $1 AND lender_kingdom_id = $2 AND status <> 'closed'",
      [this.productScope, offer.lender_kingdom_id],
    );
    const hostCount = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM garrison_contracts WHERE product_scope = $1 AND host_kingdom_id = $2 AND status <> 'closed'",
      [this.productScope, offer.host_kingdom_id],
    );
    if (
      (lenderCount.rows[0]?.count ?? 0) >= rulesCatalog.garrison.maxLentDetachments ||
      (hostCount.rows[0]?.count ?? 0) >= rulesCatalog.garrison.maxHostedDetachments
    )
      throw new GarrisonError("DETACHMENT_CAPACITY");
    const bonds = [
      [offer.lender_kingdom_id, terms.lenderBond],
      [offer.host_kingdom_id, terms.hostBond],
    ] as const;
    for (const [kingdomId, bond] of bonds) {
      if (!bond) continue;
      const balances = [];
      for (const resource of ["iron", "silver", "grain"] as const)
        balances.push(await this.ledger.readBalance(client, kingdomId, resource));
      const locked = balances.reduce((sum, balance) => sum + balance.locked, 0n);
      const cap = ((balances[0]?.storageCap ?? 0n) * BigInt(rulesCatalog.supply.totalBondCapacityPercent)) / 100n;
      if (locked + wholeResources(bond.wholeAmount) > cap) throw new GarrisonError("BOND_CAPACITY");
      await this.ledger.lockBond(client, {
        kingdomId,
        resource: bond.resource,
        amount: wholeResources(bond.wholeAmount),
        operationKey: `garrison:${offer.id}:${kingdomId}:bond`,
        gameTimeMs,
      });
    }
    const id = randomUUID();
    const start = gameTimeMs;
    const end = (Math.floor(gameTimeMs / 60_000) + 1) * 60_000 + terms.durationHours * 3_600_000;
    const lenderAuthority =
      signatures.find((signature) => signature.kingdom_id === offer.lender_kingdom_id)?.authority_ref ?? null;
    const hostAuthority =
      signatures.find((signature) => signature.kingdom_id === offer.host_kingdom_id)?.authority_ref ?? null;
    await client.query(
      `INSERT INTO garrison_contracts(id, product_scope, offer_id, lender_kingdom_id, host_kingdom_id,
         terms, status, start_game_time_ms, end_game_time_ms, lender_bond_units, host_bond_units,
         lender_authority_ref, host_authority_ref)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'active',$7,$8,$9,$10,$11,$12)`,
      [
        id,
        this.productScope,
        offer.id,
        offer.lender_kingdom_id,
        offer.host_kingdom_id,
        JSON.stringify(terms),
        start,
        end,
        terms.lenderBond ? wholeResources(terms.lenderBond.wholeAmount).toString() : "0",
        terms.hostBond ? wholeResources(terms.hostBond.wholeAmount).toString() : "0",
        lenderAuthority,
        hostAuthority,
      ],
    );
    const lenderAccount = await client.query<{ account_id: string }>(
      "SELECT account_id FROM kingdoms WHERE id = $1 AND product_scope = $2",
      [offer.lender_kingdom_id, this.productScope],
    );
    if (!lenderAccount.rows[0]) throw new GarrisonError("NOT_PARTY");
    for (const unit of terms.units) {
      await this.troops.assign(client, {
        accountId: lenderAccount.rows[0].account_id,
        ownerKingdomId: offer.lender_kingdom_id,
        hostKingdomId: offer.host_kingdom_id,
        placement: "visiting",
        referenceId: id,
        type: unit.type,
        count: unit.count,
        gameTimeMs,
      });
    }
    for (const [kingdomId, bond] of bonds) {
      const ref = kingdomId === offer.lender_kingdom_id ? lenderAuthority : hostAuthority;
      if (!ref) continue;
      await this.exposure.activate(client, ref, id);
      if (bond)
        await this.exposure.consume(client, {
          ref,
          asset: bond.resource,
          units: wholeResources(bond.wholeAmount),
          operationKey: `garrison:${id}:${kingdomId}:bond`,
          gameTimeMs,
        });
    }
    await client.query("UPDATE garrison_offers SET status = 'active' WHERE id = $1", [offer.id]);
    await this.emit(client, "garrison.contract.activated.v1", {
      contractId: id,
      gameTimeMs,
      offerId: offer.id,
      startGameTimeMs: start,
      endGameTimeMs: end,
    });
    return id;
  }

  async requestExit(
    client: PoolClient,
    input: { accountId: string; contractId: string; gameTimeMs: number },
  ): Promise<void> {
    const preview = await this.contract(client, input.contractId, false);
    await this.lockPair(client, preview.lender_kingdom_id, preview.host_kingdom_id, true);
    const party = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2",
      [this.productScope, input.accountId],
    );
    const kingdomId = party.rows[0]?.id;
    if (kingdomId !== preview.lender_kingdom_id && kingdomId !== preview.host_kingdom_id)
      throw new GarrisonError("NOT_PARTY");
    const row = await this.contract(client, input.contractId, true);
    if (row.status === "closed") return;
    const early = input.gameTimeMs < Number(row.end_game_time_ms);
    const lender = kingdomId === row.lender_kingdom_id;
    await client.query(
      `UPDATE garrison_contracts SET status = 'exit_pending',
         exit_requested_game_time_ms = COALESCE(exit_requested_game_time_ms, $3),
         lender_default = lender_default OR $4,
         host_default = host_default OR $5,
         close_reason = COALESCE(close_reason, $6)
       WHERE product_scope = $1 AND id = $2`,
      [
        this.productScope,
        row.id,
        input.gameTimeMs,
        early && lender,
        early && !lender,
        lender ? "lender_recall" : "host_return",
      ],
    );
    await this.finishPending(client, input.contractId, input.gameTimeMs);
  }

  async requestMutualRelease(
    client: PoolClient,
    input: { accountId: string; contractId: string; gameTimeMs: number },
  ): Promise<boolean> {
    const preview = await this.contract(client, input.contractId, false);
    await this.lockPair(client, preview.lender_kingdom_id, preview.host_kingdom_id);
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, input.accountId],
    );
    const party = owner.rows[0]?.id;
    if (party !== preview.lender_kingdom_id && party !== preview.host_kingdom_id) throw new GarrisonError("NOT_PARTY");
    const row = await this.contract(client, input.contractId, true);
    if (row.status !== "active") throw new GarrisonError("CONTRACT_CLOSED");
    await client.query(
      `INSERT INTO garrison_release_signatures(product_scope, contract_id, kingdom_id, signed_game_time_ms)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [this.productScope, row.id, party, input.gameTimeMs],
    );
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM garrison_release_signatures WHERE product_scope = $1 AND contract_id = $2",
      [this.productScope, row.id],
    );
    if ((count.rows[0]?.count ?? 0) < 2) return false;
    await client.query(
      `UPDATE garrison_contracts SET status = 'exit_pending', close_reason = 'mutual_release',
       exit_requested_game_time_ms = $3 WHERE product_scope = $1 AND id = $2`,
      [this.productScope, row.id, input.gameTimeMs],
    );
    await this.finishPending(client, row.id, input.gameTimeMs);
    return true;
  }

  async seize(
    client: PoolClient,
    input: { accountId: string; contractId: string; permitId: string; gameTimeMs: number },
  ): Promise<string[]> {
    const preview = await this.contract(client, input.contractId, false);
    await this.lockPair(client, preview.lender_kingdom_id, preview.host_kingdom_id);
    const owner = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, input.accountId],
    );
    if (owner.rows[0]?.id !== preview.host_kingdom_id) throw new GarrisonError("NOT_HOST");
    const row = await this.contract(client, input.contractId, true);
    if (row.status === "closed") throw new GarrisonError("CONTRACT_CLOSED");
    const survivors = await client.query<{ id: string }>(
      `SELECT id FROM kingdom_troops WHERE product_scope = $1 AND placement = 'visiting'
       AND placement_ref = $2 AND host_kingdom_id = $3 ORDER BY id FOR UPDATE`,
      [this.productScope, row.id, row.host_kingdom_id],
    );
    if (!survivors.rows.length) throw new GarrisonError("NO_SURVIVORS");
    await this.humanPermits.assertExact(client, {
      accountId: input.accountId,
      permitRef: input.permitId,
      action: "garrison.seize",
      operationKey: `garrison:${row.id}:seize`,
      assets: {},
      troopCount: survivors.rows.length,
    });
    const unitIds = await this.troops.seizeVisiting(client, {
      hostKingdomId: row.host_kingdom_id,
      referenceId: row.id,
      gameTimeMs: input.gameTimeMs,
    });
    await client.query(
      `UPDATE garrison_contracts SET status = 'exit_pending', host_default = true,
       exit_requested_game_time_ms = COALESCE(exit_requested_game_time_ms, $3),
       close_reason = 'seizure' WHERE product_scope = $1 AND id = $2`,
      [this.productScope, row.id, input.gameTimeMs],
    );
    await this.emit(client, "garrison.contract.seized.v1", {
      contractId: row.id,
      lenderKingdomId: row.lender_kingdom_id,
      hostKingdomId: row.host_kingdom_id,
      unitIds,
      gameTimeMs: input.gameTimeMs,
    });
    await this.finishPending(client, row.id, input.gameTimeMs);
    return unitIds;
  }

  /** Runs after upkeep/default capture and again after battle resolution. */
  async settleMinute(client: PoolClient, gameTimeMs: number): Promise<number> {
    const active = await client.query<{ id: string }>(
      `SELECT id FROM garrison_contracts WHERE product_scope = $1 AND status <> 'closed'
       ORDER BY end_game_time_ms, id`,
      [this.productScope],
    );
    let completed = 0;
    for (const item of active.rows) {
      const preview = await this.contract(client, item.id, false);
      await this.lockPair(client, preview.lender_kingdom_id, preview.host_kingdom_id, true);
      const row = await this.contract(client, item.id, true);
      if (row.status === "closed") continue;
      const defaulted = await client.query(
        "SELECT 1 FROM garrison_upkeep_defaults WHERE product_scope = $1 AND detachment_ref = $2",
        [this.productScope, row.id],
      );
      if (row.status === "active" && !defaulted.rowCount && gameTimeMs < Number(row.end_game_time_ms)) continue;
      if (row.status === "active") {
        await client.query(
          `UPDATE garrison_contracts SET status = 'exit_pending',
             exit_requested_game_time_ms = COALESCE(exit_requested_game_time_ms, $3),
             host_default = host_default OR $4,
             close_reason = COALESCE(close_reason, $5)
           WHERE product_scope = $1 AND id = $2`,
          [
            this.productScope,
            row.id,
            gameTimeMs,
            (defaulted.rowCount ?? 0) > 0,
            defaulted.rowCount ? "host_underfunded" : "expiry",
          ],
        );
      } else if (defaulted.rowCount && !row.host_default) {
        await client.query("UPDATE garrison_contracts SET host_default = true WHERE product_scope = $1 AND id = $2", [
          this.productScope,
          row.id,
        ]);
      }
      if (await this.finishPending(client, row.id, gameTimeMs)) completed += 1;
    }
    return completed;
  }

  private async finishPending(client: PoolClient, contractId: string, gameTimeMs: number): Promise<boolean> {
    const row = await this.contract(client, contractId, true);
    if (row.status === "closed") return false;
    const locked = await client.query(
      `SELECT 1 FROM kingdom_troops t JOIN battle_unit_eligibility e ON e.troop_id = t.id
       WHERE t.product_scope = $1 AND t.placement = 'visiting' AND t.placement_ref = $2
         AND e.product_scope = $1 AND e.locked_until_game_time_ms > $3 LIMIT 1`,
      [this.productScope, row.id, gameTimeMs],
    );
    if (locked.rowCount) return false;
    await this.troops.returnPlacement(client, {
      ownerKingdomId: row.lender_kingdom_id,
      placement: "visiting",
      referenceId: row.id,
      gameTimeMs,
    });
    const terms = validateTerms(row.terms);
    for (const [kingdomId, bond, units, defaulted, recipient] of [
      [row.lender_kingdom_id, terms.lenderBond, BigInt(row.lender_bond_units), row.lender_default, row.host_kingdom_id],
      [row.host_kingdom_id, terms.hostBond, BigInt(row.host_bond_units), row.host_default, row.lender_kingdom_id],
    ] as const) {
      if (!bond || units === 0n) continue;
      if (defaulted) {
        await this.ledger.forfeitBond(client, {
          kingdomId,
          resource: bond.resource,
          amount: units,
          operationKey: `garrison:${row.id}:${kingdomId}:forfeit`,
          gameTimeMs,
        });
        await this.ledger.creditOrdinary(client, {
          kingdomId: recipient,
          resource: bond.resource,
          amount: units,
          operationKey: `garrison:${row.id}:${recipient}:compensation`,
          reason: "garrison_default",
          gameTimeMs,
        });
      } else {
        await this.ledger.releaseBond(client, {
          kingdomId,
          resource: bond.resource,
          amount: units,
          operationKey: `garrison:${row.id}:${kingdomId}:return`,
          gameTimeMs,
        });
      }
    }
    for (const ref of [row.lender_authority_ref, row.host_authority_ref]) {
      if (ref) await this.exposure.release(client, ref, gameTimeMs);
    }
    await client.query(
      `UPDATE garrison_contracts SET status = 'closed', closed_game_time_ms = $3,
         closed_at = clock_timestamp(),
         close_reason = COALESCE(close_reason, 'expiry') WHERE product_scope = $1 AND id = $2`,
      [this.productScope, row.id, gameTimeMs],
    );
    await this.emit(client, "garrison.contract.closed.v1", {
      contractId: row.id,
      gameTimeMs,
      reason: row.close_reason ?? "expiry",
    });
    return true;
  }

  private async contract(client: PoolClient, id: string, lock: boolean): Promise<ContractRow> {
    const result = await client.query<ContractRow>(
      `SELECT * FROM garrison_contracts WHERE product_scope = $1 AND id = $2 ${lock ? "FOR UPDATE" : ""}`,
      [this.productScope, id],
    );
    if (!result.rows[0]) throw new GarrisonError("CONTRACT_NOT_FOUND");
    return result.rows[0];
  }

  private async lockPair(client: PoolClient, lenderId: string, hostId: string, allowClosing = false): Promise<void> {
    const result = await client.query(
      `SELECT id FROM kingdoms WHERE product_scope = $1 AND id IN ($2,$3)
       AND ($4 OR status = 'ranked') ORDER BY id FOR UPDATE`,
      [this.productScope, lenderId, hostId, allowClosing],
    );
    if (result.rowCount !== 2) throw new GarrisonError("NOT_PARTY");
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
