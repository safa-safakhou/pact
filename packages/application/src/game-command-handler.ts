import { type ExactHumanPermitService, ExposureError, type ExposureService } from "@pact/authority";
import type { CommandEnvelope, GameAction } from "@pact/contracts";
import { rulesCatalog, wholeResources } from "@pact/domain";
import {
  ActionLimitError,
  type BuildingEngine,
  BuildingError,
  GarrisonError,
  type GarrisonService,
  type KingdomService,
  RaidError,
  type RaidService,
  ScoutError,
  type ScoutService,
  SocialError,
  type SocialService,
  SupplyError,
  type SupplyService,
  type SupplySettlementService,
  type SupplyTerms,
  TroopError,
  type TroopService,
  upgradeQuote,
} from "@pact/kingdom";
import type { PoolClient } from "pg";
import type { GameCommandMutation } from "./dispatcher.js";
import { type AuthenticatedPrincipal, DispatcherError } from "./types.js";

/** Routes gameplay writes through one transaction and owner-derived domain services. */
export class GameCommandHandler {
  constructor(
    private readonly social: SocialService,
    private readonly assertAgentLease?: (client: PoolClient, accountId: string, holderId: string) => Promise<void>,
    private readonly kingdom?: KingdomService,
    private readonly troops?: TroopService,
    private readonly buildings?: BuildingEngine,
    private readonly humanPermits?: ExactHumanPermitService,
    private readonly supply?: SupplyService,
    private readonly supplySettlement?: SupplySettlementService,
    private readonly exposure?: ExposureService,
    private readonly scouts?: ScoutService,
    private readonly garrison?: GarrisonService,
    private readonly raids?: RaidService,
    private readonly consumeRunMessageAllowance?: (
      client: PoolClient,
      accountId: string,
      holderId: string,
    ) => Promise<boolean>,
  ) {}

  async execute(
    client: PoolClient,
    principal: AuthenticatedPrincipal,
    command: CommandEnvelope & { action: GameAction },
    gameTimeMs: number,
  ): Promise<GameCommandMutation> {
    if (principal.audience === "service") throw new DispatcherError("FORBIDDEN");
    if (principal.audience === "agent") {
      if (!principal.sessionId || !this.assertAgentLease) throw new DispatcherError("FORBIDDEN");
      try {
        await this.assertAgentLease(client, principal.accountId, principal.sessionId);
      } catch {
        throw new DispatcherError("FORBIDDEN");
      }
    }
    const action = command.action;
    const accountId = principal.accountId;
    const operationKey = command.commandId;
    try {
      switch (action.kind) {
        case "game.contact.request": {
          const id = await this.social.requestContact(client, {
            accountId,
            recipientKingdomId: action.recipientKingdomId,
            note: action.note,
            operationKey,
            gameTimeMs,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            ...(action.mandateVersion === undefined ? {} : { mandateVersion: action.mandateVersion }),
          });
          return {
            recordVersions: { [`contact-request:${id}`]: 1 },
            charged: [
              { asset: "silver", units: wholeResources(rulesCatalog.actionLimits.coldContactSilver).toString() },
            ],
          };
        }
        case "game.contact.answer": {
          if (principal.audience !== "human") throw new DispatcherError("FORBIDDEN");
          await this.social.answerRequest(client, {
            accountId,
            requestId: action.requestId,
            accept: action.accept,
            gameTimeMs,
          });
          return { recordVersions: { [`contact-request:${action.requestId}`]: 1 }, charged: [] };
        }
        case "game.message.send": {
          if (principal.audience === "agent") {
            if (!principal.sessionId || !this.consumeRunMessageAllowance) throw new DispatcherError("FORBIDDEN");
            if (!(await this.consumeRunMessageAllowance(client, accountId, principal.sessionId)))
              throw new DispatcherError("RATE_LIMITED");
          }
          const id = await this.social.sendMessage(client, {
            accountId,
            recipientKingdomId: action.recipientKingdomId,
            body: action.body,
            agentOriginated: principal.audience === "agent",
            operationKey,
            gameTimeMs,
          });
          return { recordVersions: { [`message:${id}`]: 1 }, charged: [] };
        }
        case "game.transfer": {
          const result = await this.social.transfer(client, {
            accountId,
            recipientKingdomId: action.recipientKingdomId,
            resource: action.resource,
            wholeAmount: action.wholeAmount,
            operationKey,
            gameTimeMs,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            ...(action.mandateVersion === undefined ? {} : { mandateVersion: action.mandateVersion }),
          });
          return {
            recordVersions: { [`transfer:${result.id}`]: 1 },
            charged: [{ asset: action.resource, units: (BigInt(action.wholeAmount) * 600n).toString() }],
          };
        }
        case "game.training.queue": {
          if (!this.kingdom || !this.troops) throw new DispatcherError("INVALID_COMMAND");
          const owner = await this.kingdom.getByAccountInTransaction(client, accountId);
          if (!owner) throw new DispatcherError("FORBIDDEN");
          const batch = await this.troops.queueTraining(client, {
            accountId,
            kingdomId: owner.kingdomId,
            batchId: operationKey,
            type: action.type,
            count: action.count,
            gameTimeMs,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            ...(action.mandateVersion === undefined ? {} : { mandateVersion: action.mandateVersion }),
          });
          const definition = rulesCatalog.units[action.type];
          return {
            recordVersions: { [`training:${batch.id}`]: 1 },
            charged: [
              { asset: "iron", units: wholeResources(definition.iron * action.count).toString() },
              { asset: "silver", units: wholeResources(definition.silver * action.count).toString() },
            ],
          };
        }
        case "game.training.cancel": {
          if (principal.audience !== "human" || !this.kingdom || !this.troops) throw new DispatcherError("FORBIDDEN");
          const owner = await this.kingdom.getByAccountInTransaction(client, accountId);
          if (!owner) throw new DispatcherError("FORBIDDEN");
          const batch = await this.troops.cancelTraining(client, {
            accountId,
            kingdomId: owner.kingdomId,
            batchId: action.batchId,
            gameTimeMs,
          });
          return { recordVersions: { [`training:${batch.id}`]: 2 }, charged: [] };
        }
        case "game.troop.disband": {
          if (principal.audience !== "human" || !this.kingdom || !this.troops) throw new DispatcherError("FORBIDDEN");
          const owner = await this.kingdom.getByAccountInTransaction(client, accountId);
          if (!owner) throw new DispatcherError("FORBIDDEN");
          const removed = await this.troops.disband(client, {
            accountId,
            kingdomId: owner.kingdomId,
            troopId: action.troopId,
            gameTimeMs,
          });
          if (!removed) throw new DispatcherError("INVALID_COMMAND");
          return { recordVersions: { [`troop:${action.troopId}`]: 1 }, charged: [] };
        }
        case "game.building.queue": {
          if (!this.kingdom || !this.buildings) throw new DispatcherError("INVALID_COMMAND");
          const owner = await this.kingdom.getByAccountInTransaction(client, accountId);
          if (!owner) throw new DispatcherError("FORBIDDEN");
          const quote = upgradeQuote(action.building, action.targetLevel, gameTimeMs);
          let permitId: string | undefined;
          if (principal.audience === "human") {
            if (!principal.sessionId || !this.humanPermits) throw new DispatcherError("FORBIDDEN");
            permitId = await this.humanPermits.issue(client, {
              accountId,
              humanSessionId: principal.sessionId,
              action: "building.queue",
              operationKey: `building:${operationKey}`,
              assets: { iron: quote.iron, silver: quote.silver },
            });
          }
          const instruction = await this.buildings.queue(client, {
            accountId,
            kingdomId: owner.kingdomId,
            instructionId: operationKey,
            slot: action.slot,
            kind: action.building,
            targetLevel: action.targetLevel,
            actor: principal.audience === "agent" ? "agent" : "human",
            ...(permitId ? { permitId } : {}),
            ...(action.mandateVersion === undefined ? {} : { mandateVersion: action.mandateVersion }),
            gameTimeMs,
          });
          return {
            recordVersions: { [`building:${instruction.id}`]: 1 },
            charged:
              instruction.state === "active"
                ? [
                    { asset: "iron", units: quote.iron.toString() },
                    { asset: "silver", units: quote.silver.toString() },
                  ]
                : [],
          };
        }
        case "game.building.cancel": {
          if (principal.audience !== "human" || !this.kingdom || !this.buildings)
            throw new DispatcherError("FORBIDDEN");
          const owner = await this.kingdom.getByAccountInTransaction(client, accountId);
          if (!owner) throw new DispatcherError("FORBIDDEN");
          const instruction = await this.buildings.cancel(client, {
            accountId,
            kingdomId: owner.kingdomId,
            instructionId: action.instructionId,
            gameTimeMs,
          });
          return { recordVersions: { [`building:${instruction.id}`]: 2 }, charged: [] };
        }
        case "game.supply.offer": {
          if (!this.supply) throw new DispatcherError("INVALID_COMMAND");
          const offer = await this.supply.createOffer(client, {
            accountId,
            counterpartyKingdomId: action.counterpartyKingdomId,
            offerId: operationKey,
            terms: action.terms,
            ...(action.expiryMinutes === undefined ? {} : { expiryMinutes: action.expiryMinutes }),
            gameTimeMs,
            operationKey,
          });
          return { recordVersions: { [`supply-offer:${offer.id}`]: offer.version }, charged: [] };
        }
        case "game.supply.counter": {
          if (!this.supply) throw new DispatcherError("INVALID_COMMAND");
          const version = await this.supply.counterOffer(client, {
            accountId,
            offerId: action.offerId,
            expectedVersion: action.expectedVersion,
            terms: action.terms,
            ...(action.expiryMinutes === undefined ? {} : { expiryMinutes: action.expiryMinutes }),
            gameTimeMs,
            operationKey,
          });
          return { recordVersions: { [`supply-offer:${action.offerId}`]: version }, charged: [] };
        }
        case "game.supply.sign": {
          if (!this.supply) throw new DispatcherError("INVALID_COMMAND");
          const result = await this.supply.signOffer(client, {
            accountId,
            offerId: action.offerId,
            version: action.version,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            gameTimeMs,
            operationKey,
          });
          if (!result.contractId)
            return { recordVersions: { [`supply-offer:${action.offerId}`]: action.version }, charged: [] };
          const contract = await client.query<{ terms: SupplyTerms; signer_is_a: boolean }>(
            `SELECT c.terms, c.kingdom_a = k.id AS signer_is_a
             FROM supply_contracts c JOIN kingdoms k ON k.product_scope = c.product_scope
               AND k.account_id = $3 AND k.id IN (c.kingdom_a, c.kingdom_b)
             WHERE c.product_scope = $1 AND c.id = $2`,
            [principal.productScope, result.contractId, accountId],
          );
          const row = contract.rows[0];
          if (!row) throw new DispatcherError("INVALID_COMMAND");
          const bond = row.signer_is_a ? row.terms.aBond : row.terms.bBond;
          const charged = bond ? [{ asset: bond.resource, units: wholeResources(bond.wholeAmount).toString() }] : [];
          return {
            recordVersions: {
              [`supply-offer:${action.offerId}`]: action.version,
              [`supply-contract:${result.contractId}`]: 1,
            },
            charged,
          };
        }
        case "game.supply.withdraw": {
          if (!this.supply) throw new DispatcherError("INVALID_COMMAND");
          await this.supply.withdrawOffer(client, accountId, action.offerId, gameTimeMs);
          return { recordVersions: { [`supply-offer:${action.offerId}`]: 0 }, charged: [] };
        }
        case "game.supply.notice": {
          if (!this.supplySettlement) throw new DispatcherError("INVALID_COMMAND");
          if (principal.audience === "agent") {
            if (!this.exposure) throw new DispatcherError("FORBIDDEN");
            await this.exposure.assertActionAllowed(client, accountId, "supply.break", action.mandateVersion);
          }
          await this.supplySettlement.giveNotice(client, accountId, action.contractId, gameTimeMs);
          return { recordVersions: { [`supply-contract:${action.contractId}`]: 1 }, charged: [] };
        }
        case "game.supply.refuse": {
          if (!this.supplySettlement) throw new DispatcherError("INVALID_COMMAND");
          if (principal.audience === "agent") {
            if (!this.exposure) throw new DispatcherError("FORBIDDEN");
            await this.exposure.assertActionAllowed(client, accountId, "supply.break", action.mandateVersion);
          }
          await this.supplySettlement.refuse(client, accountId, action.contractId, gameTimeMs);
          return { recordVersions: { [`supply-contract:${action.contractId}`]: 1 }, charged: [] };
        }
        case "game.supply.release": {
          if (!this.supplySettlement) throw new DispatcherError("INVALID_COMMAND");
          if (principal.audience === "agent") {
            if (!this.exposure) throw new DispatcherError("FORBIDDEN");
            await this.exposure.assertActionAllowed(client, accountId, "supply.break", action.mandateVersion);
          }
          await this.supplySettlement.signRelease(client, accountId, action.contractId, gameTimeMs);
          return { recordVersions: { [`supply-contract:${action.contractId}`]: 1 }, charged: [] };
        }
        case "game.scout.start": {
          if (!this.scouts) throw new DispatcherError("INVALID_COMMAND");
          const started = await this.scouts.start(client, {
            accountId,
            operationId: operationKey,
            operationKey,
            targetKingdomId: action.targetKingdomId,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            gameTimeMs,
            ...(action.unitIds ? { explicitUnitIds: action.unitIds } : {}),
          });
          return {
            recordVersions: { [`scout:${started.operationId}`]: 1 },
            charged: [
              { asset: "silver", units: wholeResources(rulesCatalog.scouting.silverCost).toString() },
              { asset: "grain", units: wholeResources(rulesCatalog.scouting.grainCost).toString() },
            ],
          };
        }
        case "game.scout.share": {
          if (!this.scouts) throw new DispatcherError("INVALID_COMMAND");
          await this.scouts.shareReport(client, {
            accountId,
            operationId: action.operationId,
            recipientKingdomId: action.recipientKingdomId,
            gameTimeMs,
          });
          return { recordVersions: { [`scout:${action.operationId}`]: 2 }, charged: [] };
        }
        case "game.garrison.offer": {
          if (!this.garrison) throw new DispatcherError("INVALID_COMMAND");
          const offerId = await this.garrison.createOffer(client, {
            accountId,
            hostKingdomId: action.hostKingdomId,
            offerId: operationKey,
            terms: action.terms,
            gameTimeMs,
            expiresGameTimeMs: gameTimeMs + (action.expiryMinutes ?? 15) * 60_000,
          });
          return { recordVersions: { [`garrison-offer:${offerId}`]: 1 }, charged: [] };
        }
        case "game.garrison.sign": {
          if (!this.garrison) throw new DispatcherError("INVALID_COMMAND");
          const result = await this.garrison.signOffer(client, {
            accountId,
            offerId: action.offerId,
            version: action.version,
            actorKind: principal.audience === "agent" ? "agent" : "human",
            gameTimeMs,
          });
          let charged: GameCommandMutation["charged"] = [];
          if (result.contractId) {
            const contract = await client.query<{
              terms: {
                lenderBond: { resource: "iron" | "silver" | "grain"; wholeAmount: number } | null;
                hostBond: { resource: "iron" | "silver" | "grain"; wholeAmount: number } | null;
              };
              signer_is_lender: boolean;
            }>(
              `SELECT c.terms, c.lender_kingdom_id = k.id AS signer_is_lender
               FROM garrison_contracts c JOIN kingdoms k ON k.product_scope = c.product_scope
                 AND k.account_id = $3 AND k.id IN (c.lender_kingdom_id, c.host_kingdom_id)
               WHERE c.product_scope = $1 AND c.id = $2`,
              [principal.productScope, result.contractId, accountId],
            );
            const row = contract.rows[0];
            if (!row) throw new DispatcherError("INVALID_COMMAND");
            const bond = row.signer_is_lender ? row.terms.lenderBond : row.terms.hostBond;
            charged = bond ? [{ asset: bond.resource, units: wholeResources(bond.wholeAmount).toString() }] : [];
          }
          return {
            recordVersions: {
              [`garrison-offer:${action.offerId}`]: action.version,
              ...(result.contractId ? { [`garrison-contract:${result.contractId}`]: 1 } : {}),
            },
            charged,
          };
        }
        case "game.garrison.withdraw": {
          if (!this.garrison) throw new DispatcherError("INVALID_COMMAND");
          await this.garrison.withdrawOffer(client, { accountId, offerId: action.offerId, gameTimeMs });
          return { recordVersions: { [`garrison-offer:${action.offerId}`]: 0 }, charged: [] };
        }
        case "game.garrison.seize": {
          if (principal.audience !== "human" || !principal.sessionId || !this.garrison || !this.humanPermits)
            throw new DispatcherError("FORBIDDEN");
          const count = await client.query<{ count: string }>(
            `SELECT count(*) AS count FROM kingdom_troops
             WHERE product_scope = $1 AND placement = 'visiting' AND placement_ref = $2`,
            [principal.productScope, action.contractId],
          );
          const troopCount = Number(count.rows[0]?.count ?? 0);
          if (!troopCount) throw new DispatcherError("INVALID_COMMAND");
          const permitId = await this.humanPermits.issue(client, {
            accountId,
            humanSessionId: principal.sessionId,
            action: "garrison.seize",
            operationKey: `garrison:${action.contractId}:seize`,
            assets: {},
            troopCount,
          });
          const unitIds = await this.garrison.seize(client, {
            accountId,
            contractId: action.contractId,
            permitId,
            gameTimeMs,
          });
          return {
            recordVersions: {
              [`garrison-contract:${action.contractId}`]: 3,
              ...Object.fromEntries(unitIds.map((id) => [`troop:${id}`, 2])),
            },
            charged: [],
          };
        }
        case "game.garrison.exit": {
          if (!this.garrison) throw new DispatcherError("INVALID_COMMAND");
          if (principal.audience === "agent") {
            if (!this.exposure) throw new DispatcherError("FORBIDDEN");
            await this.exposure.assertActionAllowed(client, accountId, "garrison.break", action.mandateVersion);
          }
          await this.garrison.requestExit(client, { accountId, contractId: action.contractId, gameTimeMs });
          return { recordVersions: { [`garrison-contract:${action.contractId}`]: 2 }, charged: [] };
        }
        case "game.garrison.release": {
          if (!this.garrison) throw new DispatcherError("INVALID_COMMAND");
          if (principal.audience === "agent") {
            if (!this.exposure) throw new DispatcherError("FORBIDDEN");
            await this.exposure.assertActionAllowed(client, accountId, "garrison.break", action.mandateVersion);
          }
          await this.garrison.requestMutualRelease(client, { accountId, contractId: action.contractId, gameTimeMs });
          return { recordVersions: { [`garrison-contract:${action.contractId}`]: 2 }, charged: [] };
        }
        case "game.raid.declare": {
          if (!this.raids) throw new DispatcherError("INVALID_COMMAND");
          const result = await this.raids.declare(client, {
            accountId,
            raidId: operationKey,
            targetKingdomId: action.targetKingdomId,
            units: action.units.map(({ type, count, explicitIds }) => ({
              type,
              count,
              ...(explicitIds ? { explicitIds } : {}),
            })),
            actorKind: principal.audience === "agent" ? "agent" : "human",
            gameTimeMs,
            ...(action.lootPriority ? { lootPriority: action.lootPriority } : {}),
            ...(action.nominees ? { nominees: action.nominees } : {}),
          });
          const provision = await this.raidProvision(client, principal.productScope, result.raidId, accountId);
          return { recordVersions: { [`raid:${result.raidId}`]: 1 }, charged: [{ asset: "grain", units: provision }] };
        }
        case "game.raid.nominate": {
          if (principal.audience !== "human" || !this.raids) throw new DispatcherError("FORBIDDEN");
          await this.raids.nominate(client, {
            accountId,
            raidId: action.raidId,
            slot: action.slot,
            kingdomId: action.kingdomId,
            gameTimeMs,
          });
          return { recordVersions: { [`raid:${action.raidId}`]: 2 }, charged: [] };
        }
        case "game.raid.accept": {
          if (!this.raids) throw new DispatcherError("INVALID_COMMAND");
          await this.raids.accept(client, {
            accountId,
            raidId: action.raidId,
            units: action.units.map(({ type, count, explicitIds }) => ({
              type,
              count,
              ...(explicitIds ? { explicitIds } : {}),
            })),
            actorKind: principal.audience === "agent" ? "agent" : "human",
            gameTimeMs,
          });
          const provision = await this.raidProvision(client, principal.productScope, action.raidId, accountId);
          return { recordVersions: { [`raid:${action.raidId}`]: 2 }, charged: [{ asset: "grain", units: provision }] };
        }
        case "game.raid.withdraw": {
          if (principal.audience !== "human" || !this.raids) throw new DispatcherError("FORBIDDEN");
          await this.raids.withdraw(client, { accountId, raidId: action.raidId, gameTimeMs });
          return { recordVersions: { [`raid:${action.raidId}`]: 3 }, charged: [] };
        }
      }
    } catch (error) {
      if (error instanceof DispatcherError) throw error;
      if (error instanceof ActionLimitError) throw new DispatcherError("RATE_LIMITED");
      if (error instanceof ExposureError)
        throw new DispatcherError(error.code === "STALE_MANDATE" ? "STALE_VERSION" : "FORBIDDEN");
      if (error instanceof SocialError) {
        if (
          error.code === "MESSAGE_QUEUE_FULL" ||
          error.code === "CONTACT_QUEUE_FULL" ||
          error.code === "REQUEST_EXISTS" ||
          error.code === "ALREADY_CONTACT"
        )
          throw new DispatcherError(error.code);
        throw new DispatcherError(
          error.code === "BLOCKED" || error.code === "NOT_CONTACT" ? "FORBIDDEN" : "INVALID_COMMAND",
        );
      }
      if (error instanceof TroopError)
        throw new DispatcherError(
          error.code === "UNIT_LOCKED" ? "UNIT_LOCKED" : error.code === "NOT_OWNER" ? "FORBIDDEN" : "INVALID_COMMAND",
        );
      if (error instanceof BuildingError)
        throw new DispatcherError(
          error.code === "NOT_OWNER"
            ? "FORBIDDEN"
            : error.code === "BUILDING_BUSY" || error.code === "SLOT_BUSY" || error.code === "INVALID_LEVEL"
              ? error.code
              : "INVALID_COMMAND",
        );
      if (error instanceof SupplyError)
        throw new DispatcherError(
          error.code === "NOT_PARTY"
            ? "FORBIDDEN"
            : error.code === "STALE_VERSION"
              ? "STALE_VERSION"
              : error.code === "OFFER_EXPIRED"
                ? "EXPIRED"
                : "INVALID_COMMAND",
        );
      if (error instanceof ScoutError)
        throw new DispatcherError(
          error.code === "NOT_OWNER" || error.code === "REPORT_NOT_FOUND" ? "FORBIDDEN" : "INVALID_COMMAND",
        );
      if (error instanceof GarrisonError)
        throw new DispatcherError(
          error.code === "NOT_PARTY" || error.code === "NOT_HOST"
            ? "FORBIDDEN"
            : error.code === "STALE_VERSION"
              ? "STALE_VERSION"
              : error.code === "UNIT_LOCKED"
                ? "UNIT_LOCKED"
                : "INVALID_COMMAND",
        );
      if (error instanceof RaidError)
        throw new DispatcherError(
          ["NOT_LEADER", "NOT_PARTICIPANT", "NOT_NOMINATED", "NOT_OWNER"].includes(error.code)
            ? "FORBIDDEN"
            : error.code === "UNIT_LOCKED"
              ? "UNIT_LOCKED"
              : error.code === "RAID_LOCKED"
                ? "EXPIRED"
                : "INVALID_COMMAND",
        );
      if (error instanceof Error && error.message === "SUPPLY_NOT_PARTY") throw new DispatcherError("FORBIDDEN");
      if (
        error instanceof Error &&
        ["HUMAN_SESSION_REQUIRED", "HUMAN_PERMIT_CONFLICT", "INVALID_EXACT_PERMIT"].includes(error.message)
      )
        throw new DispatcherError("FORBIDDEN");
      if (error instanceof Error && error.message.startsWith("SUPPLY_CONTRACT_"))
        throw new DispatcherError("INVALID_COMMAND");
      if (
        error instanceof Error &&
        (error.message.startsWith("INVALID_SUPPLY_") ||
          error.message === "ZERO_SUPPLY_FLOWS" ||
          error.message === "BOND_WITHOUT_FLOW" ||
          error.message === "BOND_EXCEEDS_FLOW")
      )
        throw new DispatcherError("INVALID_COMMAND");
      if (error instanceof Error && error.message === "INSUFFICIENT_STOCK")
        throw new DispatcherError("INSUFFICIENT_STOCK");
      throw error;
    }
  }

  private async raidProvision(
    client: PoolClient,
    productScope: string,
    raidId: string,
    accountId: string,
  ): Promise<string> {
    const result = await client.query<{ provision_units: string }>(
      `SELECT c.provision_units FROM raid_contributions c
       JOIN kingdoms k ON k.product_scope = c.product_scope AND k.id = c.kingdom_id
       WHERE c.product_scope = $1 AND c.raid_id = $2 AND k.account_id = $3`,
      [productScope, raidId, accountId],
    );
    if (!result.rows[0]) throw new DispatcherError("INVALID_COMMAND");
    return result.rows[0].provision_units;
  }
}
