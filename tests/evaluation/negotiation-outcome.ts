import { type CommandReceipt, CommandReceiptSchema } from "@pact/contracts";
import { withTransaction } from "@pact/db";
import {
  assertNegotiationEvidence,
  type NegotiationEvidence,
  NegotiationTermsSchema,
} from "./negotiation-contracts.js";
import design from "./negotiation-design.json" with { type: "json" };
import { designDigest } from "./negotiation-plan.js";
import type { NegotiationWorld } from "./negotiation-world.js";

type Resource = "iron" | "silver" | "grain";
type Terms = NegotiationEvidence["offers"][number]["terms"];
type CommandRow = {
  command_id: string;
  actor_id: string;
  kind: string;
  scripted_prefix: boolean;
  game_time_ms: string;
  wall_time: Date;
  receipt: CommandReceipt;
};
/** Evaluator-only database view. Never supplied through an actor adapter. */
export async function readNegotiationEvidence(world: NegotiationWorld): Promise<NegotiationEvidence> {
  return withTransaction(
    world.pool,
    async (c) => {
      const identity = (
        await c.query("SELECT cell_id,initial_state_digest FROM negotiation_fixture_identity WHERE world_id=$1", [
          world.worldId,
        ])
      ).rows;
      if (
        identity.length !== 1 ||
        identity[0].cell_id !== world.cell.id ||
        identity[0].initial_state_digest !== world.cell.initialStateDigest
      )
        throw Error("NEGOTIATION_WORLD_SCOPE_MISMATCH");
      const horizon = String(
        (await c.query("SELECT committed_game_time_ms FROM world_clocks WHERE product_scope='pact'")).rows[0]
          .committed_game_time_ms,
      );
      const ref = (kind: string, id: string) => `world:${world.worldId}:${kind}:${id}`;
      const actors: NegotiationEvidence["actors"] = [];
      for (const p of world.players) {
        const balances = (
          await c.query<{ resource: Resource; amount: string }>(
            "SELECT resource,ordinary_units::text amount FROM resource_balances WHERE kingdom_id=$1",
            [p.kingdomId],
          )
        ).rows;
        if (balances.length !== 3) throw Error("INCOMPLETE_NEGOTIATION_BALANCES");
        const final = { iron: "0", silver: "0", grain: "0" };
        for (const b of balances) final[b.resource] = b.amount;
        const other = world.players.find((a) => a.kingdomId !== p.kingdomId);
        if (!other) throw Error("MISSING_COUNTERPARTY");
        actors.push({
          actorId: p.kingdomId,
          counterpartyId: other.kingdomId,
          goalDigest: p.goalDigest,
          ordinaryStart: p.ordinaryStart,
          ordinaryFinal: final,
        });
      }
      const offers: NegotiationEvidence["offers"] = [];
      const offerRows = (
        await c.query<{
          id: string;
          version: number;
          kingdom_a: string;
          kingdom_b: string;
          current_version: number;
          status: NegotiationEvidence["offers"][number]["status"];
          terms: Terms;
          expires_game_time_ms: string;
        }>(
          `SELECT o.id,v.version,o.kingdom_a,o.kingdom_b,o.version current_version,o.status,v.terms,v.expires_game_time_ms::text FROM supply_offers o JOIN supply_offer_versions v ON v.offer_id=o.id AND v.product_scope=o.product_scope WHERE o.product_scope='pact' ORDER BY o.created_game_time_ms,o.id,v.version`,
        )
      ).rows;
      for (const o of offerRows) {
        const signed = (
          await c.query<{ kingdom_id: string }>(
            "SELECT kingdom_id FROM supply_offer_signatures WHERE product_scope='pact' AND offer_id=$1 AND version=$2 ORDER BY kingdom_id",
            [o.id, o.version],
          )
        ).rows;
        offers.push({
          id: o.id,
          version: o.version,
          kingdomA: o.kingdom_a,
          kingdomB: o.kingdom_b,
          status: o.version !== o.current_version ? "superseded" : o.status,
          signedBy: signed.map((s) => s.kingdom_id),
          terms: NegotiationTermsSchema.parse(o.terms),
          expiresGameTimeMs: o.expires_game_time_ms,
          sourceRefs: [ref("offer", `${o.id}:v${o.version}`)],
        });
      }
      const commands = (
        await c.query<CommandRow>(
          "SELECT command_id,actor_id,kind,scripted_prefix,game_time_ms::text,wall_time,receipt FROM negotiation_fixture_commands ORDER BY wall_time,command_id",
        )
      ).rows;
      const receipts: NegotiationEvidence["receipts"] = commands.map((r) => {
        const receipt = CommandReceiptSchema.parse(r.receipt);
        return {
          commandId: r.command_id,
          actorId: r.actor_id,
          kind: r.kind,
          code: receipt.code,
          recordVersions: receipt.recordVersions,
          sourceRefs: [ref("receipt", r.command_id)],
        };
      });
      const lifecycle: NegotiationEvidence["lifecycle"] = [];
      for (const r of commands) {
        const stage = r.kind.startsWith("game.contact.")
          ? "contact"
          : r.kind === "game.message.send"
            ? "dialogue"
            : r.kind === "game.supply.offer" || r.kind === "game.supply.counter"
              ? "proposal"
              : r.kind === "game.supply.sign"
                ? "signature"
                : null;
        if (stage)
          lifecycle.push({
            stage,
            actorId: r.actor_id,
            referenceId: r.command_id,
            gameTimeMs: r.game_time_ms,
            wallTime: r.wall_time.toISOString(),
            sourceRefs: [ref("receipt", r.command_id)],
            scriptedPrefix: r.scripted_prefix,
          });
      }
      const contracts: NegotiationEvidence["contracts"] = [];
      const rows = (
        await c.query<{
          id: string;
          offer_id: string;
          offer_version: number;
          kingdom_a: string;
          kingdom_b: string;
          status: NegotiationEvidence["contracts"][number]["status"];
          terms: Terms;
          start_game_time_ms: string;
          end_game_time_ms: string;
          closed_game_time_ms: string | null;
          created_at: Date;
          closed_at: Date | null;
        }>(
          "SELECT id,offer_id,offer_version,kingdom_a,kingdom_b,status,terms,start_game_time_ms::text,end_game_time_ms::text,closed_game_time_ms::text,created_at,closed_at FROM supply_contracts WHERE product_scope='pact' ORDER BY start_game_time_ms,id",
        )
      ).rows;
      for (const r of rows) {
        const terms = NegotiationTermsSchema.parse(r.terms),
          flows: NegotiationEvidence["contracts"][number]["flows"] = [];
        const source = ref("contract", r.id);
        const initiating = commands.find((x) => Object.hasOwn(x.receipt.recordVersions, `supply-contract:${r.id}`));
        const prefix = initiating?.scripted_prefix;
        if (prefix === undefined) throw Error("CONTRACT_WITHOUT_COMMITTED_SOURCE");
        lifecycle.push({
          stage: "activation",
          actorId: r.kingdom_a,
          referenceId: r.id,
          gameTimeMs: r.start_game_time_ms,
          wallTime: r.created_at.toISOString(),
          sourceRefs: [source],
          scriptedPrefix: prefix,
        });
        for (const [senderId, recipientId, flow] of [
          [r.kingdom_a, r.kingdom_b, terms.aToB],
          [r.kingdom_b, r.kingdom_a, terms.bToA],
        ] as const) {
          if (!flow) continue;
          const installments = (
            await c.query<{
              due: string;
              delivered: string;
              overflow: string;
              count: number;
              failed: number;
              last_time: string | null;
              last_wall: Date | null;
            }>(
              `SELECT coalesce(sum(i.due_units),0)::text due,coalesce(sum(i.delivered_units),0)::text delivered,coalesce(sum(i.overflow_units),0)::text overflow,count(*)::int count,count(*) FILTER(WHERE i.failure_reason IS NOT NULL)::int failed,max(i.game_time_ms)::text last_time,max(t.wall_time) last_wall FROM supply_installments i LEFT JOIN negotiation_fixture_ticks t ON t.game_time_ms=i.game_time_ms WHERE i.product_scope='pact' AND i.contract_id=$1 AND i.payer_kingdom_id=$2 AND i.recipient_kingdom_id=$3 AND i.resource=$4`,
              [r.id, senderId, recipientId, flow.resource],
            )
          ).rows[0];
          if (!installments) throw Error("INCOMPLETE_INSTALLMENT_QUERY");
          flows.push({
            senderId,
            recipientId,
            resource: flow.resource,
            wholePerHour: flow.wholePerHour,
            dueUnits: installments.due,
            deliveredUnits: installments.delivered,
            overflowUnits: installments.overflow,
            installments: installments.count,
            failedInstallments: installments.failed,
          });
          if (installments.last_time && installments.last_wall)
            lifecycle.push({
              stage: "delivery",
              actorId: senderId,
              referenceId: r.id,
              gameTimeMs: installments.last_time,
              wallTime: installments.last_wall.toISOString(),
              sourceRefs: [source, ref("installments", `${r.id}:${senderId}`)],
              scriptedPrefix: prefix,
            });
        }
        if (r.status !== "active" && r.closed_game_time_ms && r.closed_at)
          lifecycle.push({
            stage: "closure",
            actorId: r.kingdom_a,
            referenceId: r.id,
            gameTimeMs: r.closed_game_time_ms,
            wallTime: r.closed_at.toISOString(),
            sourceRefs: [source],
            scriptedPrefix: prefix,
          });
        contracts.push({
          id: r.id,
          offerId: r.offer_id,
          offerVersion: r.offer_version,
          kingdomA: r.kingdom_a,
          kingdomB: r.kingdom_b,
          status: r.status,
          terms,
          startGameTimeMs: r.start_game_time_ms,
          endGameTimeMs: r.end_game_time_ms,
          flows,
          sourceRefs: [source],
        });
      }
      return assertNegotiationEvidence(
        {
          schemaVersion: "pact.negotiation-outcome.v1",
          cellId: world.cell.id,
          worldId: world.worldId,
          rulesId: "pact-s1-v1",
          configurationDigest: world.cell.configurationDigest,
          initialStateDigest: world.cell.initialStateDigest,
          horizonGameTimeMs: horizon,
          coverage: { complete: true, sourceRefs: [ref("snapshot", horizon)], omitted: [] },
          actors,
          offers,
          contracts,
          receipts,
          lifecycle,
        },
        {
          cellId: world.cell.id,
          worldId: world.worldId,
          configurationDigest: world.cell.configurationDigest,
          initialStateDigest: world.cell.initialStateDigest,
        },
      );
    },
    { isolation: "REPEATABLE READ" },
  );
}
export interface SoloComparison {
  actorId: string;
  controlWorldId: string;
  initialStateDigest: string;
  goalDigest: string;
  horizonGameTimeMs: string;
  ordinaryDeltaByResource: Record<Resource, string>;
  supported: boolean;
  beneficial: boolean;
}
/** Pareto comparison in ordinary internal units; never values promises or founding allowances as income. */
export function compareSolo(trade: NegotiationEvidence, solo: NegotiationEvidence): SoloComparison[] {
  return trade.actors.map((actor, index) => {
    const control = solo.actors[index];
    const supported = Boolean(
      control &&
        trade.worldId !== solo.worldId &&
        trade.coverage.complete &&
        solo.coverage.complete &&
        trade.configurationDigest === solo.configurationDigest &&
        trade.initialStateDigest === solo.initialStateDigest &&
        trade.rulesId === solo.rulesId &&
        trade.horizonGameTimeMs === solo.horizonGameTimeMs &&
        control.goalDigest === actor.goalDigest &&
        JSON.stringify(control.ordinaryStart) === JSON.stringify(actor.ordinaryStart) &&
        solo.receipts.length === 0 &&
        solo.contracts.length === 0,
    );
    const goal = design.families
      .flatMap((f) => Object.values(f.initialState.goals))
      .find((g) => designDigest(g) === actor.goalDigest);
    const desired = goal && ["iron", "silver", "grain"].includes(goal.receive) ? (goal.receive as Resource) : null;
    const goalCompliant =
      goal &&
      desired &&
      "minimumReceivePerHour" in goal &&
      "maximumSendPerHour" in goal &&
      trade.contracts.length > 0 &&
      trade.contracts.every((c) => {
        const ownA = c.kingdomA === actor.actorId,
          send = ownA ? c.terms.aToB : c.terms.bToA,
          receive = ownA ? c.terms.bToA : c.terms.aToB;
        return (
          !c.terms.aBond &&
          !c.terms.bBond &&
          receive?.resource === desired &&
          receive.wholePerHour >= goal.minimumReceivePerHour &&
          (!send || send.wholePerHour <= goal.maximumSendPerHour)
        );
      });
    const delta = { iron: "0", silver: "0", grain: "0" };
    if (supported && control)
      for (const r of ["iron", "silver", "grain"] as const)
        delta[r] = (BigInt(actor.ordinaryFinal[r]) - BigInt(control.ordinaryFinal[r])).toString();
    const settled = trade.contracts.every(
      (c) =>
        c.status !== "active" &&
        c.status !== "defaulted" &&
        c.flows.every((f) => f.failedInstallments === 0 && f.deliveredUnits === f.dueUnits),
    );
    return {
      actorId: actor.actorId,
      controlWorldId: solo.worldId,
      initialStateDigest: trade.initialStateDigest,
      goalDigest: actor.goalDigest,
      horizonGameTimeMs: trade.horizonGameTimeMs,
      ordinaryDeltaByResource: delta,
      supported,
      beneficial:
        Boolean(supported && goalCompliant) &&
        settled &&
        Object.values(delta).every((v) => BigInt(v) >= 0n) &&
        Boolean(desired && BigInt(delta[desired]) > 0n),
    };
  });
}
