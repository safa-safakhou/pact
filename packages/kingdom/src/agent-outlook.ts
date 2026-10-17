import { createHash } from "node:crypto";
import { type AgentOutlook, AgentOutlookQuerySchema, AgentOutlookSchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import { wholeResources } from "@pact/domain";
import type { Pool } from "pg";
import { type GarrisonTerms, garrisonUpkeepExposure } from "./garrison.js";
import { supplyExposure } from "./supply-terms.js";
import type { OwnerKingdomView, WorldViewService } from "./world-views.js";
export class AgentOutlookError extends Error {
  constructor(readonly code: "FORBIDDEN" | "INVALID_INPUT") {
    super(code);
  }
}
type Principal = { accountId: string; productScope: string; audience: string; agentScopes?: readonly string[] };
export class AgentOutlookService {
  constructor(
    private pool: Pool,
    private scope: string,
    private world: WorldViewService,
    private feasibility: (view: OwnerKingdomView) => AgentOutlook["feasibility"],
  ) {}
  async readOwner(p: Principal, query: unknown = {}): Promise<AgentOutlook> {
    if (
      p.productScope !== this.scope ||
      !["human", "agent"].includes(p.audience) ||
      (p.audience === "agent" && !p.agentScopes?.includes("world:read"))
    )
      throw new AgentOutlookError("FORBIDDEN");
    const q = AgentOutlookQuerySchema.safeParse(query);
    if (!q.success) throw new AgentOutlookError("INVALID_INPUT");
    return withTransaction(
      this.pool,
      async (c) => {
        if (
          !(
            await c.query("SELECT 1 FROM accounts WHERE product_scope=$1 AND id=$2 AND status='active'", [
              this.scope,
              p.accountId,
            ])
          ).rowCount
        )
          throw new AgentOutlookError("FORBIDDEN");
        const view = await this.world.readSelfSnapshot(c, p.accountId, q.data.forecastMinutes);
        if (!view) throw new AgentOutlookError("FORBIDDEN");
        const garrisons = (
          await c.query<{
            id: string;
            lender_kingdom_id: string;
            host_kingdom_id: string;
            terms: GarrisonTerms;
            status: string;
            end_game_time_ms: string;
            lender_default: boolean;
            host_default: boolean;
            close_reason: string | null;
          }>(
            "SELECT id,lender_kingdom_id,host_kingdom_id,terms,status,end_game_time_ms::text,lender_default,host_default,close_reason FROM garrison_contracts WHERE product_scope=$1 AND (lender_kingdom_id=$2 OR host_kingdom_id=$2) ORDER BY start_game_time_ms DESC,id DESC LIMIT 21",
            [this.scope, view.profile.kingdomId],
          )
        ).rows;
        const snapshotRef = `world:${view.profile.kingdomId}:${view.committedTickSequence}:${view.lastCommittedEventId}`;
        const source = (kind: string, id: string) => [snapshotRef, `${kind}:${id}`];
        const parties = (
          await c.query<{ id: string; owner_is_a: boolean }>(
            "SELECT id,kingdom_a=$2 AS owner_is_a FROM supply_contracts WHERE product_scope=$1 AND (kingdom_a=$2 OR kingdom_b=$2)",
            [this.scope, view.profile.kingdomId],
          )
        ).rows;
        const commitments: AgentOutlook["commitments"] = [];
        for (const row of view.consequences.builds)
          commitments.push({
            id: row.id,
            kind: "construction",
            counterpartyRef: null,
            admission: "confirmed",
            fulfilment:
              row.state === "completed"
                ? "fulfilled"
                : ["cancelled", "canceled"].includes(row.state)
                  ? "cancelled"
                  : "pending",
            status: row.state,
            dueGameTimeMs: row.dueGameTimeMs === null ? null : String(row.dueGameTimeMs),
            authorityExposureUnits: {},
            hostFoodExposure: null,
            sourceRefs: source("construction", row.id),
          });
        for (const row of view.training)
          commitments.push({
            id: row.batchId,
            kind: "training",
            counterpartyRef: null,
            admission: "confirmed",
            fulfilment: row.completedCount >= row.requestedCount ? "fulfilled" : "pending",
            status: "active",
            dueGameTimeMs: String(row.nextUnitDueGameTimeMs),
            authorityExposureUnits: {},
            hostFoodExposure: null,
            sourceRefs: source("training", row.batchId),
          });
        for (const row of view.consequences.supplyContracts) {
          const active = view.contracts.find((v) => v.id === row.id);
          const exposure = active
            ? supplyExposure(
                active.youSend ?? null,
                parties.find((p) => p.id === active.id)?.owner_is_a ? active.terms.aBond : active.terms.bBond,
                active.terms.durationHours,
              )
            : {};
          // Admission and current material state are distinct; closure alone is not proof of delivery.
          // Retained installment aggregates cannot establish complete lifetime delivery coverage.
          const fulfilled = false;
          commitments.push({
            id: row.id,
            kind: "supply",
            counterpartyRef: row.counterparty.kingdomId,
            admission: "confirmed",
            fulfilment:
              row.status === "active"
                ? "pending"
                : row.status === "defaulted"
                  ? "defaulted"
                  : fulfilled
                    ? "fulfilled"
                    : "unknown",
            status: row.status,
            dueGameTimeMs: String(row.noticeEndGameTimeMs ?? row.endGameTimeMs),
            authorityExposureUnits: Object.fromEntries(Object.entries(exposure).map(([k, v]) => [k, String(v)])),
            hostFoodExposure: null,
            sourceRefs: source("supply-contract", row.id),
          });
        }
        const dependencies: AgentOutlook["dependencies"] = [];
        const totals = new Map<string, bigint>();
        for (const row of view.contracts)
          if (row.youReceive)
            totals.set(
              row.youReceive.resource,
              (totals.get(row.youReceive.resource) ?? 0n) + BigInt(row.youReceive.wholePerHour) * 10n,
            );
        for (const row of view.contracts)
          for (const [kind, flow] of [
            ["incoming_supply", row.youReceive],
            ["outgoing_supply", row.youSend],
          ] as const)
            if (flow) {
              const rate = BigInt(flow.wholePerHour) * 10n;
              dependencies.push({
                counterpartyRef: row.counterpartyKingdomId,
                kind,
                resource: flow.resource,
                perMinuteUnits: String(rate),
                shareNumeratorUnits: kind === "incoming_supply" ? String(rate) : null,
                shareDenominatorUnits: kind === "incoming_supply" ? String(totals.get(flow.resource) ?? 0n) : null,
                sourceRefs: source("supply-contract", row.id),
              });
            }
        for (const row of garrisons.slice(0, 20)) {
          const host = row.host_kingdom_id === view.profile.kingdomId,
            peer = host ? row.lender_kingdom_id : row.host_kingdom_id,
            maximum = garrisonUpkeepExposure(row.terms);
          const bond = host ? row.terms.hostBond : row.terms.lenderBond;
          const exposure: Record<string, string> = bond
            ? { [bond.resource]: String(wholeResources(bond.wholeAmount)) }
            : {};
          if (host) exposure.grain = String(BigInt(exposure.grain ?? "0") + maximum);
          commitments.push({
            id: row.id,
            kind: "garrison",
            counterpartyRef: peer,
            admission: "confirmed",
            fulfilment:
              row.status !== "closed"
                ? "pending"
                : row.lender_default || row.host_default
                  ? "defaulted"
                  : row.close_reason === "expiry"
                    ? "fulfilled"
                    : row.close_reason === "mutual_release"
                      ? "cancelled"
                      : "unknown",
            status: row.status,
            dueGameTimeMs: row.end_game_time_ms,
            authorityExposureUnits: exposure,
            hostFoodExposure: host
              ? {
                  signedMaximumUnits: String(maximum),
                  durationMinutes: row.terms.durationHours * 60,
                  maximumLockExtensionMinutes: 5,
                  meaning:
                    "Full signed maximum authority exposure, including the existing five-minute lock bound. Not another stock debit or a forecast of actual consumption; current visitor upkeep is already in the short forecast.",
                }
              : null,
            sourceRefs: source("garrison-contract", row.id),
          });
          if (row.status !== "closed")
            dependencies.push({
              counterpartyRef: peer,
              kind: host ? "visiting_units" : "host_food",
              resource: "grain",
              perMinuteUnits: null,
              shareNumeratorUnits: null,
              shareDenominatorUnits: null,
              sourceRefs: source("garrison-contract", row.id),
            });
        }
        const knownThreats: AgentOutlook["knownThreats"] = view.threats.map((t) => {
          const raid = view.raids.find((r) => r.raidId === t.id);
          return {
            id: t.id,
            kind: t.kind,
            status: raid?.status ?? "active",
            otherRef: raid?.otherKingdomId ?? null,
            strength: null,
            lockGameTimeMs: raid ? String(raid.lockGameTimeMs) : null,
            dueGameTimeMs: String(t.dueGameTimeMs),
            sourceRefs: source(t.kind, t.id),
          };
        });
        const battles = (
          await c.query<{ id: string; leader_kingdom_id: string; winner: string | null }>(
            "SELECT id,leader_kingdom_id,public_report->>'winner' AS winner FROM raids WHERE product_scope=$1 AND (leader_kingdom_id=$2 OR target_kingdom_id=$2) AND status='resolved' AND resolved_game_time_ms IS NOT NULL ORDER BY resolved_game_time_ms DESC,id DESC LIMIT 20",
            [this.scope, view.profile.kingdomId],
          )
        ).rows;
        const outcomes = battles.map((row) => ({
          id: row.id,
          kind: "battle" as const,
          result:
            row.winner === "attacker" || row.winner === "defender"
              ? (row.leader_kingdom_id === view.profile.kingdomId) === (row.winner === "attacker")
                ? ("won" as const)
                : ("lost" as const)
              : ("unknown" as const),
          sourceRefs: source("raid", row.id),
        }));
        const facts = {
          resources: (["iron", "silver", "grain"] as const).map((resource) => ({
            resource,
            ordinaryUnits: view.balances[resource].ordinaryUnits,
            allowanceUnits: view.balances[resource].foundingAllowanceUnits,
            lockedUnits: view.balances[resource].lockedUnits,
            productionPerMinuteUnits: view.balances[resource].productionPerMinuteUnits,
            upkeepPerMinuteUnits: resource === "grain" ? view.upkeep.perMinuteUnits : "0",
            forecastUnits: view.forecast.expected[resource].ordinaryUnits,
            forecastAllowanceUnits: view.forecast.expected[resource].foundingAllowanceUnits,
            throughGameTimeMs: String(view.forecast.throughGameTimeMs),
            sourceRefs: [snapshotRef],
          })),
          commitments,
          knownThreats,
          dependencies,
          outcomes,
          feasibility: this.feasibility(view),
        };
        const revision = createHash("sha256")
          .update(
            JSON.stringify({
              owner: view.profile.kingdomId,
              tick: view.committedTickSequence,
              time: view.asOfGameTimeMs,
              facts,
              values: view.ambition,
            }),
          )
          .digest("hex");
        return AgentOutlookSchema.parse({
          schemaVersion: "pact.agent-outlook.v1",
          ownerRef: view.profile.kingdomId,
          revision,
          asOfGameTimeMs: String(view.asOfGameTimeMs),
          committedTickSequence: view.committedTickSequence,
          sourceRefs: [snapshotRef],
          ownerValues: view.ambition,
          ...facts,
          assumptions: [
            { source: "conditional_forecast", detail: view.forecast.assumption, sourceRefs: [snapshotRef] },
            {
              source: "signed_exposure",
              detail:
                "Full signed maxima and permission reservations are not stock spending. Future partner funding, deliveries, casualties and lock extensions remain conditional.",
              sourceRefs: [snapshotRef],
            },
            {
              source: "unknown_opponent",
              detail: "No opponent private strength, intentions, future choices or dice are observed here.",
              sourceRefs: [snapshotRef],
            },
            {
              source: "admission_not_fulfilment",
              detail:
                "Accepted commands and signatures do not certify completed jobs, deliveries, military success or motive.",
              sourceRefs: [snapshotRef],
            },
          ],
          coverage: {
            opponentPrivateState: false,
            completeWorld: false,
            forecastMinutes: q.data.forecastMinutes,
            garrisonOmitted: Math.max(0, garrisons.length - 20),
            commitmentHistoryLimit: 20,
            threatLimit: 20,
            meaning:
              "Current authorized repeatable snapshot. Latest20 construction/supply/garrison records and active training; additional history may exist. Omitted/absent records prove no outcome. Ratios describe observed signed incoming flows, not partner reliability or a strategic ranking.",
          },
        });
      },
      { isolation: "REPEATABLE READ" },
    );
  }
}
