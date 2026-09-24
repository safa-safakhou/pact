import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_UNITS = 9_223_372_036_854_775_807n;

interface MandateRow {
  version: number;
  allowed_actions: string[];
  resource_limits: Record<string, string>;
  troop_limit: number;
}

interface CommitmentRow {
  id: string;
  account_id: string;
  operation_key: string;
  action: string;
  actor_kind: "agent" | "human_exception";
  subject_ref: string | null;
  permit_ref: string | null;
  mandate_version: number | null;
  troop_count: number;
  status: "reserved" | "active" | "closed";
}

interface AssetRow {
  asset: string;
  original_units: string;
  remaining_units: string;
  spent_units: string;
}

export interface HumanPermitPort {
  assertExact(
    client: PoolClient,
    input: {
      accountId: string;
      permitRef: string;
      action: string;
      operationKey: string;
      assets: Readonly<Record<string, bigint>>;
      troopCount: number;
    },
  ): Promise<void>;
}

export class FailClosedHumanPermit implements HumanPermitPort {
  async assertExact(): Promise<void> {
    throw new Error("HUMAN_PERMIT_NOT_CONFIGURED");
  }
}

export class ExposureError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "STALE_MANDATE"
      | "INSUFFICIENT_ALLOWANCE"
      | "TROOP_LIMIT"
      | "COMMITMENT_NOT_FOUND"
      | "COMMITMENT_CONFLICT"
      | "INVALID_AMOUNT",
  ) {
    super(code);
    this.name = "ExposureError";
  }
}

function validAmount(units: bigint): void {
  if (units <= 0n || units > MAX_UNITS) throw new ExposureError("INVALID_AMOUNT");
}

function limit(raw: string | undefined): bigint {
  if (!raw || !/^(0|[1-9][0-9]*)$/.test(raw)) return 0n;
  return BigInt(raw);
}

/** Product-neutral, transaction-bound future permission ledger. Resource stock remains in the domain ledger. */
export class ExposureService {
  constructor(
    private readonly productScope: string,
    private readonly permits: HumanPermitPort = new FailClosedHumanPermit(),
  ) {}

  private async lockAccount(client: PoolClient, accountId: string): Promise<void> {
    const row = await client.query("SELECT id FROM accounts WHERE product_scope = $1 AND id = $2 FOR UPDATE", [
      this.productScope,
      accountId,
    ]);
    if (row.rowCount !== 1) throw new ExposureError("FORBIDDEN");
  }

  private async mandate(client: PoolClient, accountId: string): Promise<MandateRow> {
    const result = await client.query<MandateRow>(
      "SELECT version, allowed_actions, resource_limits, troop_limit FROM kingdom_mandates WHERE product_scope = $1 AND account_id = $2 FOR UPDATE",
      [this.productScope, accountId],
    );
    if (!result.rows[0]) throw new ExposureError("FORBIDDEN");
    return result.rows[0];
  }

  /** Authorize a non-spending agent command inside the gameplay transaction. */
  async assertActionAllowed(
    client: PoolClient,
    accountId: string,
    action: string,
    mandateVersion?: number,
  ): Promise<void> {
    await this.lockAccount(client, accountId);
    const mandate = await this.mandate(client, accountId);
    if (mandateVersion !== undefined && mandate.version !== mandateVersion) throw new ExposureError("STALE_MANDATE");
    if (!mandate.allowed_actions.includes(action)) throw new ExposureError("FORBIDDEN");
  }

  private async ledger(
    client: PoolClient,
    accountId: string,
    asset: string,
  ): Promise<{ legacy: bigint; reserved: bigint }> {
    await client.query(
      `INSERT INTO authority_ledger(product_scope, account_id, asset, spent_units, reserved_units)
       VALUES ($1, $2, $3, 0, 0) ON CONFLICT DO NOTHING`,
      [this.productScope, accountId, asset],
    );
    const result = await client.query<{ spent_units: string; reserved_units: string }>(
      `SELECT spent_units, reserved_units FROM authority_ledger
       WHERE product_scope = $1 AND account_id = $2 AND asset = $3 FOR UPDATE`,
      [this.productScope, accountId, asset],
    );
    const row = result.rows[0];
    if (!row) throw new Error("AUTHORITY_LEDGER_MISSING");
    return { legacy: BigInt(row.spent_units), reserved: BigInt(row.reserved_units) };
  }

  private async rolling(client: PoolClient, accountId: string, asset: string, gameTimeMs: number): Promise<bigint> {
    const result = await client.query<{ total: string }>(
      `SELECT COALESCE(sum(units), 0)::text AS total FROM authority_spends
       WHERE product_scope = $1 AND account_id = $2 AND asset = $3 AND count_against_limit
         AND game_time_ms > $4 AND game_time_ms <= $5`,
      [this.productScope, accountId, asset, gameTimeMs - WINDOW_MS, gameTimeMs],
    );
    return BigInt(result.rows[0]?.total ?? "0");
  }

  private async commitment(client: PoolClient, ref: string): Promise<CommitmentRow> {
    const result = await client.query<CommitmentRow>(
      "SELECT * FROM authority_commitments WHERE product_scope = $1 AND id = $2 FOR UPDATE",
      [this.productScope, ref],
    );
    const row = result.rows[0];
    if (!row) throw new ExposureError("COMMITMENT_NOT_FOUND");
    return row;
  }

  async reserve(
    client: PoolClient,
    input: {
      accountId: string;
      operationKey: string;
      action: string;
      actor: "agent" | "human_exception";
      assets: Readonly<Record<string, bigint>>;
      troopCount?: number;
      subjectRef?: string;
      permitRef?: string;
      mandateVersion?: number;
      gameTimeMs: number;
    },
  ): Promise<string> {
    if (!Number.isSafeInteger(input.gameTimeMs) || input.gameTimeMs < 0) throw new ExposureError("INVALID_AMOUNT");
    if (!input.operationKey || input.operationKey.length > 200 || !input.action)
      throw new ExposureError("COMMITMENT_CONFLICT");
    const entries = Object.entries(input.assets)
      .filter(([, units]) => units !== 0n)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [, units] of entries) validAmount(units);
    const troopCount = input.troopCount ?? 0;
    if (
      !Number.isSafeInteger(troopCount) ||
      troopCount < 0 ||
      (entries.length === 0 && troopCount === 0 && input.action !== "supply.sign")
    )
      throw new ExposureError("INVALID_AMOUNT");
    await this.lockAccount(client, input.accountId);
    const previous = await client.query<CommitmentRow>(
      "SELECT * FROM authority_commitments WHERE product_scope = $1 AND account_id = $2 AND operation_key = $3 FOR UPDATE",
      [this.productScope, input.accountId, input.operationKey],
    );
    if (previous.rows[0]) {
      const row = previous.rows[0];
      const existing = await client.query<AssetRow>(
        "SELECT * FROM authority_commitment_assets WHERE product_scope = $1 AND commitment_id = $2",
        [this.productScope, row.id],
      );
      if (
        row.action !== input.action ||
        row.actor_kind !== input.actor ||
        row.troop_count !== troopCount ||
        row.permit_ref !== (input.permitRef ?? null) ||
        existing.rows.length !== entries.length ||
        entries.some(
          ([asset, units]) => existing.rows.find((item) => item.asset === asset)?.original_units !== units.toString(),
        )
      )
        throw new ExposureError("COMMITMENT_CONFLICT");
      return row.id;
    }
    let capturedMandateVersion: number | null = null;
    if (input.actor === "human_exception") {
      if (!input.permitRef) throw new ExposureError("FORBIDDEN");
      await this.permits.assertExact(client, {
        accountId: input.accountId,
        permitRef: input.permitRef,
        action: input.action,
        operationKey: input.operationKey,
        assets: input.assets,
        troopCount,
      });
    } else {
      const mandate = await this.mandate(client, input.accountId);
      capturedMandateVersion = mandate.version;
      if (input.mandateVersion !== undefined && input.mandateVersion !== mandate.version)
        throw new ExposureError("STALE_MANDATE");
      if (!mandate.allowed_actions.includes(input.action)) throw new ExposureError("FORBIDDEN");
      for (const [asset, units] of entries) {
        const balance = await this.ledger(client, input.accountId, asset);
        const spent = await this.rolling(client, input.accountId, asset, input.gameTimeMs);
        if (balance.legacy + spent + balance.reserved + units > limit(mandate.resource_limits[asset]))
          throw new ExposureError("INSUFFICIENT_ALLOWANCE");
      }
      if (troopCount) {
        const used = await client.query<{ total: string }>(
          `SELECT COALESCE(sum(troop_count), 0)::text AS total FROM authority_commitments
           WHERE product_scope = $1 AND account_id = $2 AND actor_kind = 'agent' AND status <> 'closed'`,
          [this.productScope, input.accountId],
        );
        if (BigInt(used.rows[0]?.total ?? "0") + BigInt(troopCount) > BigInt(mandate.troop_limit))
          throw new ExposureError("TROOP_LIMIT");
      }
    }
    const ref = randomUUID();
    await client.query(
      `INSERT INTO authority_commitments(id, product_scope, account_id, operation_key, action,
         actor_kind, subject_ref, permit_ref, mandate_version, troop_count, status, created_game_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'reserved', $11)`,
      [
        ref,
        this.productScope,
        input.accountId,
        input.operationKey,
        input.action,
        input.actor,
        input.subjectRef ?? null,
        input.permitRef ?? null,
        capturedMandateVersion,
        troopCount,
        input.gameTimeMs,
      ],
    );
    for (const [asset, units] of entries) {
      await client.query(
        `INSERT INTO authority_commitment_assets(product_scope, commitment_id, asset, original_units, remaining_units)
         VALUES ($1, $2, $3, $4, $4)`,
        [this.productScope, ref, asset, units.toString()],
      );
      if (input.actor === "agent")
        await client.query(
          `UPDATE authority_ledger SET reserved_units = reserved_units + $4
         WHERE product_scope = $1 AND account_id = $2 AND asset = $3`,
          [this.productScope, input.accountId, asset, units.toString()],
        );
    }
    return ref;
  }

  async activate(client: PoolClient, ref: string, subjectRef: string): Promise<void> {
    const owner = await client.query<{ account_id: string }>(
      "SELECT account_id FROM authority_commitments WHERE product_scope = $1 AND id = $2",
      [this.productScope, ref],
    );
    if (!owner.rows[0]) throw new ExposureError("COMMITMENT_NOT_FOUND");
    await this.lockAccount(client, owner.rows[0].account_id);
    const row = await this.commitment(client, ref);
    if (row.status === "closed" || (row.subject_ref && row.subject_ref !== subjectRef))
      throw new ExposureError("COMMITMENT_CONFLICT");
    await client.query("UPDATE authority_commitments SET status = 'active', subject_ref = $2 WHERE id = $1", [
      ref,
      subjectRef,
    ]);
  }

  async consume(
    client: PoolClient,
    input: { ref: string; asset: string; units: bigint; operationKey: string; gameTimeMs: number },
  ): Promise<void> {
    if (input.units === 0n) return;
    validAmount(input.units);
    const owner = await client.query<{ account_id: string }>(
      "SELECT account_id FROM authority_commitments WHERE product_scope = $1 AND id = $2",
      [this.productScope, input.ref],
    );
    if (!owner.rows[0]) throw new ExposureError("COMMITMENT_NOT_FOUND");
    await this.lockAccount(client, owner.rows[0].account_id);
    const row = await this.commitment(client, input.ref);
    const previous = await client.query<{ units: string; commitment_id: string }>(
      `SELECT units, commitment_id FROM authority_spends WHERE product_scope = $1 AND account_id = $2
       AND operation_key = $3 AND asset = $4`,
      [this.productScope, row.account_id, input.operationKey, input.asset],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].units !== input.units.toString() || previous.rows[0].commitment_id !== input.ref)
        throw new ExposureError("COMMITMENT_CONFLICT");
      return;
    }
    if (row.status === "closed") throw new ExposureError("COMMITMENT_CONFLICT");
    const asset = await client.query<AssetRow>(
      `SELECT * FROM authority_commitment_assets WHERE product_scope = $1 AND commitment_id = $2
       AND asset = $3 FOR UPDATE`,
      [this.productScope, input.ref, input.asset],
    );
    if (!asset.rows[0] || BigInt(asset.rows[0].remaining_units) < input.units)
      throw new ExposureError("INSUFFICIENT_ALLOWANCE");
    await client.query(
      `UPDATE authority_commitment_assets SET remaining_units = remaining_units - $4,
         spent_units = spent_units + $4 WHERE product_scope = $1 AND commitment_id = $2 AND asset = $3`,
      [this.productScope, input.ref, input.asset, input.units.toString()],
    );
    if (row.actor_kind === "agent")
      await client.query(
        `UPDATE authority_ledger SET reserved_units = reserved_units - $4
       WHERE product_scope = $1 AND account_id = $2 AND asset = $3`,
        [this.productScope, row.account_id, input.asset, input.units.toString()],
      );
    await client.query(
      `INSERT INTO authority_spends(id, product_scope, account_id, asset, units, game_time_ms,
         operation_key, commitment_id, count_against_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        this.productScope,
        row.account_id,
        input.asset,
        input.units.toString(),
        input.gameTimeMs,
        input.operationKey,
        input.ref,
        row.actor_kind === "agent",
      ],
    );
  }

  async release(client: PoolClient, ref: string, gameTimeMs: number): Promise<void> {
    const owner = await client.query<{ account_id: string }>(
      "SELECT account_id FROM authority_commitments WHERE product_scope = $1 AND id = $2",
      [this.productScope, ref],
    );
    if (!owner.rows[0]) throw new ExposureError("COMMITMENT_NOT_FOUND");
    await this.lockAccount(client, owner.rows[0].account_id);
    const row = await this.commitment(client, ref);
    if (row.status === "closed") return;
    const assets = await client.query<AssetRow>(
      "SELECT * FROM authority_commitment_assets WHERE product_scope = $1 AND commitment_id = $2 FOR UPDATE",
      [this.productScope, ref],
    );
    for (const asset of assets.rows) {
      const remaining = BigInt(asset.remaining_units);
      if (remaining > 0n && row.actor_kind === "agent")
        await client.query(
          `UPDATE authority_ledger SET reserved_units = reserved_units - $4
         WHERE product_scope = $1 AND account_id = $2 AND asset = $3`,
          [this.productScope, row.account_id, asset.asset, remaining.toString()],
        );
    }
    await client.query(
      "UPDATE authority_commitment_assets SET remaining_units = 0 WHERE product_scope = $1 AND commitment_id = $2",
      [this.productScope, ref],
    );
    await client.query(
      "UPDATE authority_commitments SET status = 'closed', closed_game_time_ms = $2, closed_at = clock_timestamp() WHERE id = $1",
      [ref, gameTimeMs],
    );
  }

  async spendImmediate(
    client: PoolClient,
    input: {
      accountId: string;
      asset: string;
      units: bigint;
      action: string;
      operationKey: string;
      mandateVersion?: number;
      gameTimeMs: number;
    },
  ): Promise<void> {
    validAmount(input.units);
    await this.lockAccount(client, input.accountId);
    const previous = await client.query<{ units: string; commitment_id: string | null }>(
      `SELECT units, commitment_id FROM authority_spends WHERE product_scope = $1 AND account_id = $2
       AND operation_key = $3 AND asset = $4`,
      [this.productScope, input.accountId, input.operationKey, input.asset],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].units !== input.units.toString() || previous.rows[0].commitment_id !== null)
        throw new ExposureError("COMMITMENT_CONFLICT");
      return;
    }
    const mandate = await this.mandate(client, input.accountId);
    if (input.mandateVersion !== undefined && input.mandateVersion !== mandate.version)
      throw new ExposureError("STALE_MANDATE");
    if (!mandate.allowed_actions.includes(input.action)) throw new ExposureError("FORBIDDEN");
    const balance = await this.ledger(client, input.accountId, input.asset);
    const spent = await this.rolling(client, input.accountId, input.asset, input.gameTimeMs);
    if (balance.legacy + balance.reserved + spent + input.units > limit(mandate.resource_limits[input.asset]))
      throw new ExposureError("INSUFFICIENT_ALLOWANCE");
    await client.query(
      `INSERT INTO authority_spends(id, product_scope, account_id, asset, units, game_time_ms,
         operation_key, count_against_limit) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [
        randomUUID(),
        this.productScope,
        input.accountId,
        input.asset,
        input.units.toString(),
        input.gameTimeMs,
        input.operationKey,
      ],
    );
  }

  async referencesForSubject(client: PoolClient, subjectRef: string): Promise<string[]> {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM authority_commitments WHERE product_scope = $1 AND subject_ref = $2
       AND status <> 'closed' ORDER BY id`,
      [this.productScope, subjectRef],
    );
    return result.rows.map((row) => row.id);
  }

  /** Waiting agent work must recheck mandate version and action; active contracts instead use their signed reservation. */
  async canStartWaiting(client: PoolClient, ref: string, action: string): Promise<boolean> {
    const owner = await client.query<{ account_id: string }>(
      "SELECT account_id FROM authority_commitments WHERE product_scope = $1 AND id = $2",
      [this.productScope, ref],
    );
    if (!owner.rows[0]) throw new ExposureError("COMMITMENT_NOT_FOUND");
    await this.lockAccount(client, owner.rows[0].account_id);
    const row = await this.commitment(client, ref);
    if (row.status === "closed" || row.action !== action) return false;
    if (row.actor_kind === "human_exception") return true;
    const mandate = await this.mandate(client, row.account_id);
    return row.mandate_version === mandate.version && mandate.allowed_actions.includes(action);
  }
}
