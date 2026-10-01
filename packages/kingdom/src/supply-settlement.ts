import { randomUUID } from "node:crypto";
import { appendOutbox } from "@pact/db";
import { hourlyRatePerMinute, wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { PoolClient } from "pg";
import type { SupplyBond, SupplyResource, SupplyTerms } from "./supply-terms.js";

interface Contract {
  id: string;
  offer_id: string;
  offer_version: number;
  kingdom_a: string;
  kingdom_b: string;
  terms: SupplyTerms;
  start_game_time_ms: string;
  end_game_time_ms: string;
  notice_end_game_time_ms: string | null;
}

interface Obligation {
  contract: Contract;
  payer: string;
  recipient: string;
  resource: SupplyResource;
  due: bigint;
  allocated: bigint;
  failureReason: string | null;
  authorityRef: string | null;
}

export interface SupplyReserveFloorPort {
  read(client: PoolClient, accountId: string, resource: SupplyResource): Promise<bigint>;
}

export interface SupplySettlementAuthorityPort {
  consume(
    client: PoolClient,
    authorityRef: string,
    resource: SupplyResource,
    amount: bigint,
    operationKey: string,
    gameTimeMs: number,
  ): Promise<void>;
  release(client: PoolClient, authorityRef: string, gameTimeMs: number): Promise<void>;
}

class NoopSupplySettlementAuthority implements SupplySettlementAuthorityPort {
  async consume(): Promise<void> {}
  async release(): Promise<void> {}
}

/** Exact internal-unit allocation; ID order receives residual units. */
export function allocateSupplyProportionally<T extends { id: string; due: bigint }>(
  obligations: readonly T[],
  available: bigint,
): Map<string, bigint> {
  if (available < 0n) throw new Error("INVALID_AVAILABLE_STOCK");
  const sorted = [...obligations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const total = sorted.reduce((sum, item) => sum + item.due, 0n);
  const allocation = new Map<string, bigint>();
  if (total === 0n) return allocation;
  const budget = available < total ? available : total;
  let remainder = budget;
  for (const item of sorted) {
    const share = (item.due * budget) / total;
    allocation.set(item.id, share);
    remainder -= share;
  }
  for (const item of sorted) {
    if (remainder === 0n) break;
    allocation.set(item.id, (allocation.get(item.id) ?? 0n) + 1n);
    remainder -= 1n;
  }
  return allocation;
}

export class SupplySettlementService {
  private captured: { gameTimeMs: number; obligations: Obligation[] } | null = null;

  constructor(
    private readonly productScope: string,
    private readonly ledger: ResourceLedger,
    private readonly floors: SupplyReserveFloorPort,
    private readonly authority: SupplySettlementAuthorityPort = new NoopSupplySettlementAuthority(),
  ) {}

  private async contract(client: PoolClient, id: string): Promise<Contract> {
    const result = await client.query<Contract>(
      "SELECT * FROM supply_contracts WHERE product_scope = $1 AND id = $2 FOR UPDATE",
      [this.productScope, id],
    );
    const row = result.rows[0];
    if (!row) throw new Error("SUPPLY_CONTRACT_NOT_FOUND");
    return row;
  }

  private async party(client: PoolClient, accountId: string, contract: Contract): Promise<string> {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM kingdoms WHERE product_scope = $1 AND account_id = $2 AND id IN ($3, $4)",
      [this.productScope, accountId, contract.kingdom_a, contract.kingdom_b],
    );
    if (!result.rows[0]) throw new Error("SUPPLY_NOT_PARTY");
    return result.rows[0].id;
  }

  async giveNotice(client: PoolClient, accountId: string, contractId: string, gameTimeMs: number): Promise<number> {
    const contract = await this.contract(client, contractId);
    const party = await this.party(client, accountId, contract);
    const status = await client.query<{ status: string }>("SELECT status FROM supply_contracts WHERE id = $1", [
      contractId,
    ]);
    if (status.rows[0]?.status !== "active") throw new Error("SUPPLY_CONTRACT_CLOSED");
    if (contract.notice_end_game_time_ms !== null) return Number(contract.notice_end_game_time_ms);
    const deadline = (Math.floor(gameTimeMs / 60_000) + 1) * 60_000 + contract.terms.noticeHours * 3_600_000;
    await client.query("UPDATE supply_contracts SET notice_by = $2, notice_end_game_time_ms = $3 WHERE id = $1", [
      contractId,
      party,
      deadline,
    ]);
    return deadline;
  }

  async refuse(client: PoolClient, accountId: string, contractId: string, gameTimeMs: number): Promise<void> {
    const contract = await this.contract(client, contractId);
    const party = await this.party(client, accountId, contract);
    const status = await client.query<{ status: string }>("SELECT status FROM supply_contracts WHERE id = $1", [
      contractId,
    ]);
    if (status.rows[0]?.status !== "active") throw new Error("SUPPLY_CONTRACT_CLOSED");
    const deadline = (Math.floor(gameTimeMs / 60_000) + 1) * 60_000;
    await client.query(
      `INSERT INTO supply_refusals(product_scope, contract_id, kingdom_id, effective_game_time_ms)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [this.productScope, contractId, party, deadline],
    );
  }

  async signRelease(client: PoolClient, accountId: string, contractId: string, gameTimeMs: number): Promise<void> {
    const contract = await this.contract(client, contractId);
    const party = await this.party(client, accountId, contract);
    const status = await client.query<{ status: string }>("SELECT status FROM supply_contracts WHERE id = $1", [
      contractId,
    ]);
    if (status.rows[0]?.status !== "active") throw new Error("SUPPLY_CONTRACT_CLOSED");
    await client.query(
      `INSERT INTO supply_release_signatures(product_scope, contract_id, kingdom_id, signed_game_time_ms)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [this.productScope, contractId, party, gameTimeMs],
    );
  }

  /** Owner deletion is an immediate default, not notice or a new voluntary transfer. */
  async defaultForRetirement(client: PoolClient, kingdomId: string, gameTimeMs: number): Promise<number> {
    const contracts = await client.query<Contract>(
      `SELECT * FROM supply_contracts WHERE product_scope = $1 AND status = 'active'
       AND (kingdom_a = $2 OR kingdom_b = $2) ORDER BY id FOR UPDATE`,
      [this.productScope, kingdomId],
    );
    for (const contract of contracts.rows) {
      const closing = await client.query<{ id: string }>(
        `SELECT id FROM kingdoms WHERE product_scope = $1 AND id IN ($2, $3)
         AND status IN ('closing', 'retired')`,
        [this.productScope, contract.kingdom_a, contract.kingdom_b],
      );
      await this.close(
        client,
        contract,
        gameTimeMs,
        "owner_retirement",
        new Set([kingdomId, ...closing.rows.map((row) => row.id)]),
      );
    }
    return contracts.rows.length;
  }

  /** Phase 1: stop contracts before delivery on their end, notice, or agreed release boundary. */
  async settleBoundaries(client: PoolClient, gameTimeMs: number): Promise<number> {
    const result = await client.query<Contract>(
      `SELECT * FROM supply_contracts WHERE product_scope = $1 AND status = 'active'
       AND (end_game_time_ms <= $2 OR notice_end_game_time_ms <= $2
         OR EXISTS (SELECT 1 FROM supply_refusals r WHERE r.product_scope = $1
           AND r.contract_id = supply_contracts.id AND r.effective_game_time_ms <= $2)
         OR (SELECT count(*) FROM supply_release_signatures s
             WHERE s.product_scope = $1 AND s.contract_id = supply_contracts.id
             AND s.signed_game_time_ms < $2) = 2)
       ORDER BY id FOR UPDATE`,
      [this.productScope, gameTimeMs],
    );
    for (const contract of result.rows) {
      const mutual = await client.query<{ count: string }>(
        `SELECT count(*)::text FROM supply_release_signatures
         WHERE product_scope = $1 AND contract_id = $2 AND signed_game_time_ms < $3`,
        [this.productScope, contract.id, gameTimeMs],
      );
      const refusals = await client.query<{ kingdom_id: string }>(
        `SELECT kingdom_id FROM supply_refusals WHERE product_scope = $1 AND contract_id = $2
         AND effective_game_time_ms <= $3`,
        [this.productScope, contract.id, gameTimeMs],
      );
      const reason = refusals.rowCount
        ? "owner_termination"
        : Number(contract.end_game_time_ms) <= gameTimeMs
          ? "natural_expiry"
          : Number(mutual.rows[0]?.count ?? "0") === 2
            ? "mutual_release"
            : "notice_expiry";
      await this.close(client, contract, gameTimeMs, reason, new Set(refusals.rows.map((row) => row.kingdom_id)));
    }
    return result.rowCount ?? 0;
  }

  /** Phase 4: read all post-upkeep balances and floors before any delivery debit or credit. */
  async capture(client: PoolClient, gameTimeMs: number): Promise<void> {
    const contracts = await client.query<Contract>(
      `SELECT * FROM supply_contracts WHERE product_scope = $1 AND status = 'active'
       AND start_game_time_ms <= $2 AND end_game_time_ms > $2 ORDER BY id`,
      [this.productScope, gameTimeMs],
    );
    const obligations: Obligation[] = [];
    for (const contract of contracts.rows) {
      const signatures = await client.query<{ kingdom_id: string; authority_ref: string | null }>(
        `SELECT kingdom_id, authority_ref FROM supply_offer_signatures
         WHERE product_scope = $1 AND offer_id = $2 AND version = $3`,
        [this.productScope, contract.offer_id, contract.offer_version],
      );
      for (const [payer, recipient, flow] of [
        [contract.kingdom_a, contract.kingdom_b, contract.terms.aToB],
        [contract.kingdom_b, contract.kingdom_a, contract.terms.bToA],
      ] as const) {
        if (!flow) continue;
        obligations.push({
          contract,
          payer,
          recipient,
          resource: flow.resource,
          due: hourlyRatePerMinute(flow.wholePerHour),
          allocated: 0n,
          failureReason: null,
          authorityRef: signatures.rows.find((row) => row.kingdom_id === payer)?.authority_ref ?? null,
        });
      }
    }
    const groups = new Map<string, Obligation[]>();
    for (const obligation of obligations) {
      const key = `${obligation.payer}:${obligation.resource}`;
      groups.set(key, [...(groups.get(key) ?? []), obligation]);
    }
    for (const group of groups.values()) {
      const first = group[0];
      if (!first) continue;
      const balance = await this.ledger.readBalance(client, first.payer, first.resource);
      const owner = await client.query<{ account_id: string }>(
        "SELECT account_id FROM kingdoms WHERE product_scope = $1 AND id = $2",
        [this.productScope, first.payer],
      );
      if (!owner.rows[0]) throw new Error("SUPPLY_PAYER_NOT_FOUND");
      const floor = await this.floors.read(client, owner.rows[0].account_id, first.resource);
      if (floor < 0n) throw new Error("INVALID_RESERVE_FLOOR");
      const usable = balance.ordinary + (first.resource === "grain" ? balance.allowance : 0n);
      const excess = usable > floor ? usable - floor : 0n;
      const available = balance.ordinary < excess ? balance.ordinary : excess;
      const allocation = allocateSupplyProportionally(
        group.map((item) => ({ id: item.contract.id, due: item.due })),
        available,
      );
      for (const item of group) {
        item.allocated = allocation.get(item.contract.id) ?? 0n;
        if (item.allocated < item.due)
          item.failureReason = available < balance.ordinary ? "reserve_constraint" : "insufficient_stock";
      }
    }
    this.captured = { gameTimeMs, obligations };
  }

  /** Phase 5: debit every payer first, then credit all recipients. */
  async settleDeliveries(client: PoolClient, gameTimeMs: number): Promise<void> {
    const batch = this.requireCapture(gameTimeMs);
    for (const item of batch.obligations) {
      if (item.allocated > 0n)
        await this.ledger.debit(client, {
          kingdomId: item.payer,
          resource: item.resource,
          amount: item.allocated,
          purpose: "trade",
          operationKey: `supply:${item.contract.id}:${gameTimeMs}:${item.payer}:debit`,
          gameTimeMs,
        });
      if (item.allocated > 0n && item.authorityRef)
        await this.authority.consume(
          client,
          item.authorityRef,
          item.resource,
          item.allocated,
          `supply:${item.contract.id}:${gameTimeMs}:${item.payer}:authority`,
          gameTimeMs,
        );
    }
    for (const item of batch.obligations) {
      let overflow = 0n;
      if (item.allocated > 0n) {
        const credit = await this.ledger.creditOrdinary(client, {
          kingdomId: item.recipient,
          resource: item.resource,
          amount: item.allocated,
          operationKey: `supply:${item.contract.id}:${gameTimeMs}:${item.payer}:credit`,
          reason: "supply_delivery",
          gameTimeMs,
        });
        overflow = credit.overflow;
      }
      await client.query(
        `INSERT INTO supply_installments(product_scope, contract_id, game_time_ms, payer_kingdom_id,
           recipient_kingdom_id, resource, due_units, delivered_units, overflow_units, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          this.productScope,
          item.contract.id,
          gameTimeMs,
          item.payer,
          item.recipient,
          item.resource,
          item.due.toString(),
          item.allocated.toString(),
          overflow.toString(),
          item.failureReason,
        ],
      );
    }
    const byContract = new Map<string, Obligation[]>();
    for (const item of batch.obligations)
      byContract.set(item.contract.id, [...(byContract.get(item.contract.id) ?? []), item]);
    for (const [contractId, items] of byContract) {
      if (items.some((item) => item.allocated > 0n))
        await appendOutbox(client, {
          productScope: this.productScope,
          eventId: randomUUID(),
          type: "supply.delivery.executed.v1",
          payload: { contractId, gameTimeMs },
        });
      if (items.length !== 2 || items.some((item) => item.due <= 0n || item.allocated !== item.due)) continue;
      const contract = items[0]?.contract;
      if (!contract) continue;
      await appendOutbox(client, {
        productScope: this.productScope,
        eventId: randomUUID(),
        type: "supply.full_both_delivered.v1",
        payload: { contractId, kingdomA: contract.kingdom_a, kingdomB: contract.kingdom_b, gameTimeMs },
      });
    }
  }

  /** Phase 6: funded counterparty delivery remains committed; only future flow stops. */
  async settleDefaults(client: PoolClient, gameTimeMs: number): Promise<number> {
    const batch = this.requireCapture(gameTimeMs);
    const failures = new Map<string, Set<string>>();
    for (const item of batch.obligations) {
      if (!item.failureReason) continue;
      const set = failures.get(item.contract.id) ?? new Set<string>();
      set.add(item.payer);
      failures.set(item.contract.id, set);
    }
    for (const [id, parties] of failures) {
      const contract = batch.obligations.find((item) => item.contract.id === id)?.contract;
      if (!contract) throw new Error("SUPPLY_CAPTURE_MISSING_CONTRACT");
      const reason =
        batch.obligations.find((item) => item.contract.id === id && item.failureReason)?.failureReason ??
        "insufficient_stock";
      await this.close(client, contract, gameTimeMs, reason, parties);
    }
    this.captured = null;
    return failures.size;
  }

  private requireCapture(gameTimeMs: number): { gameTimeMs: number; obligations: Obligation[] } {
    if (!this.captured || this.captured.gameTimeMs !== gameTimeMs) throw new Error("SUPPLY_CAPTURE_MISSING");
    return this.captured;
  }

  private async close(
    client: PoolClient,
    contract: Contract,
    gameTimeMs: number,
    reason: string,
    defaulters: Set<string>,
  ): Promise<void> {
    for (const [owner, recipient, bond] of [
      [contract.kingdom_a, contract.kingdom_b, contract.terms.aBond],
      [contract.kingdom_b, contract.kingdom_a, contract.terms.bBond],
    ] as const) {
      if (!bond) continue;
      await this.distributeBond(client, contract.id, owner, recipient, bond, defaulters.has(owner), gameTimeMs);
    }
    const status = defaulters.size ? "defaulted" : reason === "natural_expiry" ? "expired" : "released";
    const signatures = await client.query<{ authority_ref: string | null }>(
      `SELECT authority_ref FROM supply_offer_signatures
       WHERE product_scope = $1 AND offer_id = $2 AND version = $3`,
      [this.productScope, contract.offer_id, contract.offer_version],
    );
    for (const signature of signatures.rows) {
      if (signature.authority_ref) await this.authority.release(client, signature.authority_ref, gameTimeMs);
    }
    await client.query(
      `UPDATE supply_contracts SET status = $2, close_reason = $3, closed_game_time_ms = $4,
         closed_at = clock_timestamp() WHERE id = $1 AND status = 'active'`,
      [contract.id, status, reason, gameTimeMs],
    );
    await appendOutbox(client, {
      productScope: this.productScope,
      eventId: randomUUID(),
      type: status === "defaulted" ? "supply.contract.defaulted.v1" : "supply.contract.closed.v1",
      payload:
        status === "defaulted"
          ? { contractId: contract.id, kingdomA: contract.kingdom_a, kingdomB: contract.kingdom_b, gameTimeMs }
          : { contractId: contract.id, kingdomA: contract.kingdom_a, kingdomB: contract.kingdom_b, gameTimeMs, reason },
    });
  }

  private async distributeBond(
    client: PoolClient,
    id: string,
    owner: string,
    recipient: string,
    bond: SupplyBond,
    forfeited: boolean,
    gameTimeMs: number,
  ): Promise<void> {
    const amount = wholeResources(bond.wholeAmount);
    if (!forfeited) {
      await this.ledger.releaseBond(client, {
        kingdomId: owner,
        resource: bond.resource,
        amount,
        operationKey: `supply:${id}:${owner}:bond:return`,
        gameTimeMs,
      });
      return;
    }
    await this.ledger.forfeitBond(client, {
      kingdomId: owner,
      resource: bond.resource,
      amount,
      operationKey: `supply:${id}:${owner}:bond:forfeit`,
      gameTimeMs,
    });
    await this.ledger.creditOrdinary(client, {
      kingdomId: recipient,
      resource: bond.resource,
      amount,
      operationKey: `supply:${id}:${owner}:bond:compensate`,
      reason: "bond_compensation",
      gameTimeMs,
    });
  }
}
