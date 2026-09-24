import { type ExposureService, readReserveFloor } from "@pact/authority";
import { wholeResources } from "@pact/domain";
import type { ResourceLedger } from "@pact/ledger";
import type { PoolClient } from "pg";
import type { ConstructionAuthorityPort } from "./buildings.js";
import type { SupplyAuthorityPort } from "./supply.js";
import type { SupplySettlementAuthorityPort } from "./supply-settlement.js";
import type { SupplyBond, SupplyResource } from "./supply-terms.js";
import type { VisitingUpkeepAuthorityPort } from "./upkeep.js";

export interface ImmediateAuthorityPort {
  spend(
    client: PoolClient,
    input: {
      accountId: string;
      asset: SupplyResource;
      units: bigint;
      action: string;
      operationKey: string;
      mandateVersion?: number;
      gameTimeMs: number;
    },
  ): Promise<void>;
}

export class ImmediateExposureAdapter implements ImmediateAuthorityPort {
  constructor(private readonly exposure: ExposureService) {}

  spend(
    client: PoolClient,
    input: {
      accountId: string;
      asset: SupplyResource;
      units: bigint;
      action: string;
      operationKey: string;
      mandateVersion?: number;
      gameTimeMs: number;
    },
  ): Promise<void> {
    return this.exposure.spendImmediate(client, input);
  }
}

/** Actual visiting Grain debits consume only the host's signed exposure, never ordinary owner upkeep. */
export class GarrisonUpkeepExposureAdapter implements VisitingUpkeepAuthorityPort {
  constructor(
    private readonly productScope: string,
    private readonly exposure: ExposureService,
  ) {}

  async consume(client: PoolClient, detachmentRef: string, units: bigint, gameTimeMs: number): Promise<void> {
    const result = await client.query<{ host_authority_ref: string | null }>(
      `SELECT host_authority_ref FROM garrison_contracts
       WHERE product_scope = $1 AND id = $2 AND status <> 'closed'`,
      [this.productScope, detachmentRef],
    );
    const ref = result.rows[0]?.host_authority_ref;
    if (!result.rows[0]) throw new Error("GARRISON_CONTRACT_NOT_FOUND");
    if (!ref) return; // Human manual signature does not consume an agent allowance.
    await this.exposure.consume(client, {
      ref,
      asset: "grain",
      units,
      operationKey: `garrison:${detachmentRef}:upkeep:${gameTimeMs}`,
      gameTimeMs,
    });
  }
}

/** Domain adapter translates contract terms into product-neutral exposure assets. */
export class SupplyExposureAdapter implements SupplyAuthorityPort, SupplySettlementAuthorityPort {
  constructor(private readonly exposure: ExposureService) {}

  reserve(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      offerId: string;
      version: number;
      exposure: Partial<Record<SupplyResource, bigint>>;
      gameTimeMs: number;
      permitId?: string;
    },
  ): Promise<string> {
    return this.exposure.reserve(client, {
      accountId: input.accountId,
      operationKey: `supply:${input.offerId}:${input.version}:${input.kingdomId}`,
      action: "supply.sign",
      actor: input.permitId ? "human_exception" : "agent",
      assets: input.exposure as Record<string, bigint>,
      ...(input.permitId ? { permitRef: input.permitId } : {}),
      gameTimeMs: input.gameTimeMs,
    });
  }

  async activate(
    client: PoolClient,
    authorityRef: string,
    contractId: string,
    gameTimeMs: number,
    bond: SupplyBond | null,
  ): Promise<void> {
    await this.exposure.activate(client, authorityRef, contractId);
    if (bond)
      await this.exposure.consume(client, {
        ref: authorityRef,
        asset: bond.resource,
        units: wholeResources(bond.wholeAmount),
        operationKey: `supply:${contractId}:${authorityRef}:bond`,
        gameTimeMs,
      });
  }

  consume(
    client: PoolClient,
    authorityRef: string,
    resource: SupplyResource,
    amount: bigint,
    operationKey: string,
    gameTimeMs: number,
  ): Promise<void> {
    return this.exposure.consume(client, {
      ref: authorityRef,
      asset: resource,
      units: amount,
      operationKey,
      gameTimeMs,
    });
  }

  release(client: PoolClient, authorityRef: string, gameTimeMs: number): Promise<void> {
    return this.exposure.release(client, authorityRef, gameTimeMs);
  }
}

/** Building queues reserve full quoted authority, then spend only ordinary-resource debits at start. */
export class ConstructionExposureAdapter implements ConstructionAuthorityPort {
  constructor(
    private readonly productScope: string,
    private readonly exposure: ExposureService,
    private readonly ledger: ResourceLedger,
  ) {}

  reserve(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      instructionId: string;
      actor: "human" | "agent";
      permitId?: string;
      mandateVersion?: number;
      iron: bigint;
      silver: bigint;
      gameTimeMs: number;
    },
  ): Promise<string> {
    return this.exposure.reserve(client, {
      accountId: input.accountId,
      operationKey: `building:${input.instructionId}`,
      action: "building.queue",
      actor: input.actor === "agent" ? "agent" : "human_exception",
      assets: { iron: input.iron, silver: input.silver },
      subjectRef: input.instructionId,
      ...(input.permitId ? { permitRef: input.permitId } : {}),
      ...(input.mandateVersion === undefined ? {} : { mandateVersion: input.mandateVersion }),
      gameTimeMs: input.gameTimeMs,
    });
  }

  async recheckAndStart(
    client: PoolClient,
    input: {
      accountId: string;
      kingdomId: string;
      instructionId: string;
      actor: "human" | "agent";
      authorityRef: string;
      mandateVersion: number | null;
      ordinaryIron: bigint;
      ordinarySilver: bigint;
      gameTimeMs: number;
    },
  ): Promise<boolean> {
    if (!(await this.exposure.canStartWaiting(client, input.authorityRef, "building.queue"))) return false;
    if (input.actor === "agent") {
      for (const [asset, amount] of [
        ["iron", input.ordinaryIron],
        ["silver", input.ordinarySilver],
      ] as const) {
        const floor = await readReserveFloor(client, this.productScope, input.accountId, asset);
        const balance = await this.ledger.readBalance(client, input.kingdomId, asset);
        if (balance.ordinary < amount || balance.ordinary - amount < floor) return false;
      }
    }
    await this.exposure.activate(client, input.authorityRef, input.instructionId);
    for (const [asset, amount] of [
      ["iron", input.ordinaryIron],
      ["silver", input.ordinarySilver],
    ] as const) {
      if (amount > 0n)
        await this.exposure.consume(client, {
          ref: input.authorityRef,
          asset,
          units: amount,
          operationKey: `building:${input.instructionId}:${asset}:start`,
          gameTimeMs: input.gameTimeMs,
        });
    }
    await this.exposure.release(client, input.authorityRef, input.gameTimeMs);
    return true;
  }

  releaseWaiting(client: PoolClient, authorityRef: string, _instructionId: string, gameTimeMs: number): Promise<void> {
    return this.exposure.release(client, authorityRef, gameTimeMs);
  }

  async recordActiveCancellation(): Promise<void> {
    // The debit was spent at start. An ordinary or allowance refund does not restore authority.
  }
}
