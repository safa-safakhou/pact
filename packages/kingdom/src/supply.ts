import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { rulesCatalog, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { PoolClient } from "pg";
import type { ActionLimitService } from "./action-limits.js";
import type { SocialService } from "./social.js";
import { type SupplyBond, type SupplyFlow, type SupplyTerms, validateSupplyTerms } from "./supply-terms.js";

interface OfferRow {
  id: string;
  kingdom_a: string;
  kingdom_b: string;
  version: number;
  terms: SupplyTerms;
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
  offer_id: string;
  offer_version: number;
  start_game_time_ms: string;
  end_game_time_ms: string;
}

export interface SupplyAuthorityPort {
  reserve(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      offerId: string;
      version: number;
      exposure: Partial<Record<"iron" | "silver" | "grain", bigint>>;
      gameTimeMs: number;
      permitId?: string;
    },
  ): Promise<string>;
  release(client: PoolClient, authorityRef: string, gameTimeMs: number): Promise<void>;
  activate(
    client: PoolClient,
    authorityRef: string,
    contractId: string,
    gameTimeMs: number,
    bond: SupplyBond | null,
  ): Promise<void>;
}

export class FailClosedSupplyAuthority implements SupplyAuthorityPort {
  async reserve(): Promise<string> {
    throw new Error("SUPPLY_AUTHORITY_NOT_CONFIGURED");
  }
  async release(): Promise<void> {
    throw new Error("SUPPLY_AUTHORITY_NOT_CONFIGURED");
  }
  async activate(): Promise<void> {
    throw new Error("SUPPLY_AUTHORITY_NOT_CONFIGURED");
  }
}

export class SupplyError extends Error {
  constructor(
    readonly code:
      | "NOT_PARTY"
      | "OFFER_NOT_FOUND"
      | "OFFER_EXPIRED"
      | "OFFER_CLOSED"
      | "STALE_VERSION"
      | "RATE_TOO_HIGH"
      | "CONTRACT_CAPACITY"
      | "BOND_CAPACITY"
      | "OPERATION_CONFLICT",
  ) {
    super(code);
    this.name = "SupplyError";
  }
}

function flowFor(offer: OfferRow, party: string): SupplyFlow | null {
  return party === offer.kingdom_a ? offer.terms.aToB : offer.terms.bToA;
}

function bondFor(offer: OfferRow, party: string): SupplyBond | null {
  return party === offer.kingdom_a ? offer.terms.aBond : offer.terms.bBond;
}

function exposure(
  flow: SupplyFlow | null,
  bond: SupplyBond | null,
  durationHours: number,
): Partial<Record<"iron" | "silver" | "grain", bigint>> {
  const values: Partial<Record<"iron" | "silver" | "grain", bigint>> = {};
  if (flow) values[flow.resource] = wholeResources(flow.wholePerHour) * BigInt(durationHours);
  if (bond) values[bond.resource] = (values[bond.resource] ?? 0n) + wholeResources(bond.wholeAmount);
  return values;
}

function termsKey(value: SupplyTerms): string {
  const flow = (item: SupplyFlow | null) => (item ? [item.resource, item.wholePerHour] : null);
  const bond = (item: SupplyBond | null) => (item ? [item.resource, item.wholeAmount] : null);
  return JSON.stringify([
    flow(value.aToB),
    flow(value.bToA),
    bond(value.aBond),
    bond(value.bBond),
    value.durationHours,
    value.noticeHours,
  ]);
}

export class SupplyService {
  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly limits: ActionLimitService,
    private readonly social: SocialService,
    private readonly authority: SupplyAuthorityPort = new FailClosedSupplyAuthority(),
  ) {}

  private async ownerKingdom(client: PoolClient, accountId: string): Promise<string> {
    const found = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND status = 'ranked'",
      [this.productScope, accountId],
    );
    if (!found.rows[0]) throw new SupplyError("NOT_PARTY");
    return found.rows[0].id;
  }

  private async lockPair(client: PoolClient, a: string, b: string, allowBlocked = false): Promise<void> {
    if (a === b) throw new SupplyError("NOT_PARTY");
    const result = await client.query(
      `SELECT id FROM kingdoms WHERE product_scope = $1 AND id IN ($2, $3)
       AND ($4 OR status = 'ranked') ORDER BY id FOR UPDATE`,
      [this.productScope, a, b, allowBlocked],
    );
    if (result.rowCount !== 2) throw new SupplyError("NOT_PARTY");
    if (!allowBlocked) await this.social.assertDirectCommunicationAllowed(client, a, b);
  }

  private async offer(client: PoolClient, offerId: string): Promise<OfferRow> {
    const found = await client.query<OfferRow>(
      "SELECT * FROM supply_offers WHERE product_scope = $1 AND id = $2 FOR UPDATE",
      [this.productScope, offerId],
    );
    if (!found.rows[0]) throw new SupplyError("OFFER_NOT_FOUND");
    return found.rows[0];
  }

  private assertOpen(offer: OfferRow, gameTimeMs: number, version: number): void {
    if (offer.version !== version) throw new SupplyError("STALE_VERSION");
    if (offer.status === "expired" || Number(offer.expires_game_time_ms) <= gameTimeMs)
      throw new SupplyError("OFFER_EXPIRED");
    if (offer.status !== "open") throw new SupplyError("OFFER_CLOSED");
  }

  private async validateRates(client: PoolClient, offer: OfferRow): Promise<void> {
    validateSupplyTerms(offer.terms);
    for (const party of [offer.kingdom_a, offer.kingdom_b]) {
      const flow = flowFor(offer, party);
      if (!flow) continue;
      const balance = await this.ledger.readBalance(client, party, flow.resource);
      if (wholeResources(flow.wholePerHour) > balance.storageCap) throw new SupplyError("RATE_TOO_HIGH");
    }
  }

  async createOffer(
    client: PoolClient,
    input: {
      accountId: string;
      counterpartyKingdomId: string;
      offerId: string;
      terms: SupplyTerms;
      expiryMinutes?: number;
      gameTimeMs: number;
      operationKey: string;
    },
  ): Promise<{ id: string; version: number }> {
    validateSupplyTerms(input.terms);
    const minutes = input.expiryMinutes ?? rulesCatalog.supply.defaultOfferExpiryMinutes;
    if (
      !Number.isInteger(minutes) ||
      minutes < rulesCatalog.supply.minOfferExpiryMinutes ||
      minutes > rulesCatalog.supply.maxOfferExpiryMinutes
    )
      throw new SupplyError("OFFER_EXPIRED");
    const party = await this.ownerKingdom(client, input.accountId);
    await this.lockPair(client, party, input.counterpartyKingdomId);
    const existing = await client.query<OfferRow>("SELECT * FROM supply_offers WHERE product_scope = $1 AND id = $2", [
      this.productScope,
      input.offerId,
    ]);
    if (existing.rows[0]) {
      const old = existing.rows[0];
      if (
        old.kingdom_a !== party ||
        old.kingdom_b !== input.counterpartyKingdomId ||
        termsKey(old.terms) !== termsKey(input.terms)
      )
        throw new SupplyError("OPERATION_CONFLICT");
      return { id: old.id, version: old.version };
    }
    const offer: OfferRow = {
      id: input.offerId,
      kingdom_a: party,
      kingdom_b: input.counterpartyKingdomId,
      version: 1,
      terms: input.terms,
      status: "open",
      expires_game_time_ms: String(input.gameTimeMs + minutes * 60_000),
    };
    await this.validateRates(client, offer);
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: party,
      kind: "offer_action",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    await client.query(
      `INSERT INTO supply_offers(id, product_scope, kingdom_a, kingdom_b, version, terms, status,
         expires_game_time_ms, created_game_time_ms, updated_game_time_ms)
       VALUES ($1, $2, $3, $4, 1, $5::jsonb, 'open', $6, $7, $7)`,
      [
        input.offerId,
        this.productScope,
        party,
        input.counterpartyKingdomId,
        JSON.stringify(input.terms),
        offer.expires_game_time_ms,
        input.gameTimeMs,
      ],
    );
    await this.emit(client, "supply.offer.created.v1", { offerId: input.offerId, version: 1 });
    return { id: input.offerId, version: 1 };
  }

  async counterOffer(
    client: PoolClient,
    input: {
      accountId: string;
      offerId: string;
      expectedVersion: number;
      terms: SupplyTerms;
      expiryMinutes?: number;
      gameTimeMs: number;
      operationKey: string;
    },
  ): Promise<number> {
    validateSupplyTerms(input.terms);
    const party = await this.ownerKingdom(client, input.accountId);
    const preview = await client.query<OfferRow>("SELECT * FROM supply_offers WHERE product_scope = $1 AND id = $2", [
      this.productScope,
      input.offerId,
    ]);
    if (!preview.rows[0]) throw new SupplyError("OFFER_NOT_FOUND");
    if (party !== preview.rows[0].kingdom_a && party !== preview.rows[0].kingdom_b) throw new SupplyError("NOT_PARTY");
    await this.lockPair(client, preview.rows[0].kingdom_a, preview.rows[0].kingdom_b);
    const offer = await this.offer(client, input.offerId);
    this.assertOpen(offer, input.gameTimeMs, input.expectedVersion);
    const minutes = input.expiryMinutes ?? rulesCatalog.supply.defaultOfferExpiryMinutes;
    if (
      !Number.isInteger(minutes) ||
      minutes < rulesCatalog.supply.minOfferExpiryMinutes ||
      minutes > rulesCatalog.supply.maxOfferExpiryMinutes
    )
      throw new SupplyError("OFFER_EXPIRED");
    const proposed = { ...offer, terms: input.terms };
    await this.validateRates(client, proposed);
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: party,
      kind: "offer_action",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    await this.releaseSignatures(client, offer.id, offer.version, input.gameTimeMs);
    await client.query(
      `UPDATE supply_offers SET version = version + 1, terms = $2::jsonb,
         expires_game_time_ms = $3, updated_game_time_ms = $4 WHERE id = $1`,
      [offer.id, JSON.stringify(input.terms), input.gameTimeMs + minutes * 60_000, input.gameTimeMs],
    );
    await this.emit(client, "supply.offer.countered.v1", { offerId: offer.id, version: offer.version + 1 });
    return offer.version + 1;
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
      operationKey: string;
    },
  ): Promise<{ signed: true; contractId: string | null }> {
    if (input.actorKind === "agent" && input.permitId) throw new SupplyError("OPERATION_CONFLICT");
    const party = await this.ownerKingdom(client, input.accountId);
    const preview = await client.query<OfferRow>("SELECT * FROM supply_offers WHERE product_scope = $1 AND id = $2", [
      this.productScope,
      input.offerId,
    ]);
    if (!preview.rows[0]) throw new SupplyError("OFFER_NOT_FOUND");
    if (party !== preview.rows[0].kingdom_a && party !== preview.rows[0].kingdom_b) throw new SupplyError("NOT_PARTY");
    await this.lockPair(client, preview.rows[0].kingdom_a, preview.rows[0].kingdom_b);
    const offer = await this.offer(client, input.offerId);
    if (offer.status === "active" && offer.version === input.version) {
      const previous = await client.query<SignatureRow>(
        "SELECT * FROM supply_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3 AND kingdom_id = $4",
        [this.productScope, offer.id, offer.version, party],
      );
      const contract = await client.query<ContractRow>(
        "SELECT * FROM supply_contracts WHERE product_scope = $1 AND offer_id = $2",
        [this.productScope, offer.id],
      );
      if (
        previous.rows[0]?.actor_kind === input.actorKind &&
        Boolean(previous.rows[0]?.authority_ref) === Boolean(input.permitId || input.actorKind === "agent") &&
        contract.rows[0]
      )
        return { signed: true, contractId: contract.rows[0].id };
    }
    this.assertOpen(offer, input.gameTimeMs, input.version);
    const signed = await client.query<SignatureRow>(
      "SELECT * FROM supply_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3 ORDER BY kingdom_id",
      [this.productScope, offer.id, offer.version],
    );
    const existing = signed.rows.find((row) => row.kingdom_id === party);
    if (existing) {
      if (
        existing.actor_kind !== input.actorKind ||
        Boolean(existing.authority_ref) !== Boolean(input.permitId || input.actorKind === "agent")
      )
        throw new SupplyError("OPERATION_CONFLICT");
      return { signed: true, contractId: null };
    }
    await this.validateRates(client, offer);
    await this.limits.recordSuccessfulAction(client, {
      kingdomId: party,
      kind: "offer_action",
      operationKey: input.operationKey,
      gameTimeMs: input.gameTimeMs,
    });
    const authorityRef =
      input.actorKind === "agent" || input.permitId
        ? await this.authority.reserve(client, {
            accountId: input.accountId,
            kingdomId: party,
            offerId: offer.id,
            version: offer.version,
            exposure: exposure(flowFor(offer, party), bondFor(offer, party), offer.terms.durationHours),
            gameTimeMs: input.gameTimeMs,
            ...(input.permitId ? { permitId: input.permitId } : {}),
          })
        : null;
    await client.query(
      `INSERT INTO supply_offer_signatures(product_scope, offer_id, version, kingdom_id, actor_kind, authority_ref, signed_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [this.productScope, offer.id, offer.version, party, input.actorKind, authorityRef, input.gameTimeMs],
    );
    if (signed.rowCount !== 1) return { signed: true, contractId: null };
    const contractId = await this.activate(
      client,
      offer,
      [...signed.rows, { kingdom_id: party, actor_kind: input.actorKind, authority_ref: authorityRef }],
      input.gameTimeMs,
    );
    return { signed: true, contractId };
  }

  private async activate(
    client: PoolClient,
    offer: OfferRow,
    signatures: SignatureRow[],
    gameTimeMs: number,
  ): Promise<string> {
    await this.validateRates(client, offer);
    for (const party of [offer.kingdom_a, offer.kingdom_b]) {
      const active = await client.query<{ terms: SupplyTerms; kingdom_a: string; kingdom_b: string }>(
        `SELECT terms, kingdom_a, kingdom_b FROM supply_contracts WHERE product_scope = $1 AND status = 'active'
         AND (kingdom_a = $2 OR kingdom_b = $2)`,
        [this.productScope, party],
      );
      let outgoing = 0;
      let incoming = 0;
      for (const row of active.rows) {
        const ownFlow = party === row.kingdom_a ? row.terms.aToB : row.terms.bToA;
        const otherFlow = party === row.kingdom_a ? row.terms.bToA : row.terms.aToB;
        if (ownFlow) outgoing += 1;
        if (otherFlow) incoming += 1;
      }
      if (
        (flowFor(offer, party) && outgoing >= rulesCatalog.supply.maxOutgoing) ||
        (flowFor(offer, party === offer.kingdom_a ? offer.kingdom_b : offer.kingdom_a) &&
          incoming >= rulesCatalog.supply.maxIncoming)
      )
        throw new SupplyError("CONTRACT_CAPACITY");
      const bond = bondFor(offer, party);
      if (bond) {
        const balances = [];
        for (const resource of ["iron", "silver", "grain"] as const) {
          balances.push(await this.ledger.readBalance(client, party, resource));
        }
        const totalLocked = balances.reduce((sum, balance) => sum + balance.locked, 0n);
        const capacity = balances[0]?.storageCap ?? 0n;
        if (
          totalLocked + wholeResources(bond.wholeAmount) >
          (capacity * BigInt(rulesCatalog.supply.totalBondCapacityPercent)) / 100n
        )
          throw new SupplyError("BOND_CAPACITY");
      }
    }
    for (const party of [offer.kingdom_a, offer.kingdom_b]) {
      const bond = bondFor(offer, party);
      if (bond)
        await this.ledger.lockBond(client, {
          kingdomId: party,
          resource: bond.resource,
          amount: wholeResources(bond.wholeAmount),
          operationKey: `supply-bond:${offer.id}:${offer.version}:${party}`,
          gameTimeMs,
        });
    }
    const id = randomUUID();
    const start = Math.floor(gameTimeMs / 60_000) * 60_000 + 60_000;
    const end = start + offer.terms.durationHours * 3_600_000;
    await client.query(
      `INSERT INTO supply_contracts(id, product_scope, offer_id, offer_version, kingdom_a, kingdom_b,
         terms, start_game_time_ms, end_game_time_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'active')`,
      [
        id,
        this.productScope,
        offer.id,
        offer.version,
        offer.kingdom_a,
        offer.kingdom_b,
        JSON.stringify(offer.terms),
        start,
        end,
      ],
    );
    for (const signature of signatures) {
      if (signature.authority_ref)
        await this.authority.activate(
          client,
          signature.authority_ref,
          id,
          gameTimeMs,
          bondFor(offer, signature.kingdom_id),
        );
    }
    await client.query("UPDATE supply_offers SET status = 'active' WHERE id = $1", [offer.id]);
    await this.emit(client, "supply.contract.activated.v1", {
      contractId: id,
      offerId: offer.id,
      version: offer.version,
      startGameTimeMs: start,
      endGameTimeMs: end,
    });
    return id;
  }

  async withdrawOffer(client: PoolClient, accountId: string, offerId: string, gameTimeMs: number): Promise<void> {
    const party = await this.ownerKingdom(client, accountId);
    const preview = await client.query<OfferRow>("SELECT * FROM supply_offers WHERE product_scope = $1 AND id = $2", [
      this.productScope,
      offerId,
    ]);
    if (!preview.rows[0]) throw new SupplyError("OFFER_NOT_FOUND");
    if (party !== preview.rows[0].kingdom_a && party !== preview.rows[0].kingdom_b) throw new SupplyError("NOT_PARTY");
    await this.lockPair(client, preview.rows[0].kingdom_a, preview.rows[0].kingdom_b, true);
    const offer = await this.offer(client, offerId);
    if (offer.status === "withdrawn") return;
    if (offer.status !== "open") throw new SupplyError("OFFER_CLOSED");
    await this.releaseSignatures(client, offer.id, offer.version, gameTimeMs);
    await client.query(
      "UPDATE supply_offers SET status = 'withdrawn', updated_game_time_ms = $2, closed_at = clock_timestamp() WHERE id = $1",
      [offer.id, gameTimeMs],
    );
    await this.emit(client, "supply.offer.withdrawn.v1", { offerId });
  }

  async expireOffers(client: PoolClient, gameTimeMs: number): Promise<number> {
    const due = await client.query<OfferRow>(
      "SELECT * FROM supply_offers WHERE product_scope = $1 AND status = 'open' AND expires_game_time_ms <= $2 ORDER BY id",
      [this.productScope, gameTimeMs],
    );
    let expired = 0;
    for (const preview of due.rows) {
      await this.lockPair(client, preview.kingdom_a, preview.kingdom_b, true);
      const offer = await this.offer(client, preview.id);
      if (offer.status !== "open" || Number(offer.expires_game_time_ms) > gameTimeMs) continue;
      await this.releaseSignatures(client, offer.id, offer.version, gameTimeMs);
      await client.query(
        "UPDATE supply_offers SET status = 'expired', updated_game_time_ms = $2, closed_at = clock_timestamp() WHERE id = $1",
        [offer.id, gameTimeMs],
      );
      expired += 1;
    }
    return expired;
  }

  private async releaseSignatures(
    client: PoolClient,
    offerId: string,
    version: number,
    gameTimeMs: number,
  ): Promise<void> {
    const signatures = await client.query<SignatureRow>(
      "SELECT * FROM supply_offer_signatures WHERE product_scope = $1 AND offer_id = $2 AND version = $3",
      [this.productScope, offerId, version],
    );
    for (const signature of signatures.rows) {
      if (signature.authority_ref) await this.authority.release(client, signature.authority_ref, gameTimeMs);
    }
  }

  private async emit(client: PoolClient, type: string, payload: Record<string, unknown>): Promise<void> {
    await appendOutbox(client, { productScope: this.productScope, eventId: randomUUID(), type, payload });
  }
}
