import { withTransaction } from "@pact/db";
import type { Pool, PoolClient } from "pg";

export interface OwnerRecordState {
  record: string;
  label: string;
  status: string;
  nextStep: string;
  asOfGameTimeMs: number;
  offerStatus?: string;
  contractStatus?: string | null;
  signaturesOnVersion?: number;
  offerVersion?: number;
  activated?: boolean;
}
/** Selected private record status for an authenticated owner; no messages, stocks or arguments. */
export class OwnerRecordStates {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly clock: { read(client: PoolClient): Promise<{ gameTimeMs: number }> },
  ) {}
  async read(accountId: string, records: string[]): Promise<OwnerRecordState[]> {
    const selected = [...new Set(records)]
      .filter((record) => /^[a-z-]{1,40}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record))
      .slice(0, 200);
    return withTransaction(
      this.pool,
      async (client) => {
        const owner = (
          await client.query<{ id: string }>("SELECT id FROM kingdoms WHERE product_scope=$1 AND account_id=$2", [
            this.scope,
            accountId,
          ])
        ).rows[0];
        if (!owner) return [];
        const asOfGameTimeMs = (await this.clock.read(client)).gameTimeMs,
          output: OwnerRecordState[] = [];
        const ids = (prefix: string) =>
          selected.filter((record) => record.startsWith(`${prefix}:`)).map((record) => record.slice(prefix.length + 1));
        const builds = await client.query<{ id: string; building_kind: string; target_level: number; state: string }>(
          "SELECT id,building_kind,target_level,state FROM building_instructions WHERE product_scope=$1 AND account_id=$2 AND id=ANY($3::uuid[])",
          [this.scope, accountId, ids("building")],
        );
        for (const b of builds.rows)
          output.push({
            record: `building:${b.id}`,
            label: `${b.building_kind} level ${b.target_level}`,
            status: b.state,
            asOfGameTimeMs,
            nextStep:
              b.state === "completed"
                ? "Construction finished. Choose your next objective from current resources."
                : b.state === "canceled"
                  ? "Construction canceled; no completion is pending."
                  : "Construction is pending on the game clock. Inspect the current builder deadline.",
          });
        const requests = await client.query<{
          id: string;
          status: string;
          expires_game_time_ms: string;
          recipient_kingdom_id: string;
          handle: string;
        }>(
          `SELECT r.id,r.status,r.expires_game_time_ms,r.recipient_kingdom_id,k.handle FROM cold_contact_requests r JOIN kingdoms k ON k.product_scope=r.product_scope AND k.id=CASE WHEN r.sender_kingdom_id=$2 THEN r.recipient_kingdom_id ELSE r.sender_kingdom_id END WHERE r.product_scope=$1 AND (r.sender_kingdom_id=$2 OR r.recipient_kingdom_id=$2) AND r.id=ANY($3::uuid[])`,
          [this.scope, owner.id, ids("contact-request")],
        );
        for (const r of requests.rows) {
          const status =
            r.status === "pending" && Number(r.expires_game_time_ms) <= asOfGameTimeMs ? "expired" : r.status;
          output.push({
            record: `contact-request:${r.id}`,
            label: `Contact with @${r.handle}`,
            status,
            asOfGameTimeMs,
            nextStep:
              status === "accepted"
                ? "Contact accepted. You can message and negotiate; no further acceptance is pending."
                : status === "pending"
                  ? r.recipient_kingdom_id === owner.id
                    ? "Review the incoming request under the current recipient social delegation; pending is not an accepted contact."
                    : "Await the recipient's owner or delegated agent decision; no agreement is assumed."
                  : `Contact request ${status}; respect the decision and choose another goal.`,
          });
        }
        const offers = await client.query<{
          id: string;
          version: number;
          status: string;
          contract_status: string | null;
          signatures: number;
        }>(
          `SELECT o.id,o.version,o.status,c.status AS contract_status,(SELECT count(*)::int FROM supply_offer_signatures s WHERE s.product_scope=o.product_scope AND s.offer_id=o.id AND s.version=o.version) AS signatures FROM supply_offers o LEFT JOIN supply_contracts c ON c.product_scope=o.product_scope AND c.offer_id=o.id WHERE o.product_scope=$1 AND (o.kingdom_a=$2 OR o.kingdom_b=$2) AND o.id=ANY($3::uuid[])`,
          [this.scope, owner.id, ids("supply-offer")],
        );
        for (const o of offers.rows)
          output.push({
            record: `supply-offer:${o.id}`,
            label: `Supply offer · current version ${o.version}`,
            status: o.contract_status ?? o.status,
            offerStatus: o.status,
            contractStatus: o.contract_status,
            offerVersion: o.version,
            signaturesOnVersion: o.signatures,
            activated: o.contract_status !== null,
            asOfGameTimeMs,
            nextStep: o.contract_status
              ? `Contract ${o.contract_status}; inspect actual deliveries in People or Chronicle. No proposal signature is pending.`
              : o.status === "open"
                ? `${o.signatures} signatures on this version. Read exact terms before any remaining signature; no active contract is assumed.`
                : `Offer ${o.status}; no activation is pending.`,
          });
        const contracts = await client.query<{ id: string; status: string }>(
          "SELECT id,status FROM supply_contracts WHERE product_scope=$1 AND (kingdom_a=$2 OR kingdom_b=$2) AND id=ANY($3::uuid[])",
          [this.scope, owner.id, ids("supply-contract")],
        );
        for (const c of contracts.rows)
          output.push({
            record: `supply-contract:${c.id}`,
            label: "Signed supply contract",
            status: c.status,
            asOfGameTimeMs,
            nextStep:
              c.status === "active"
                ? "Contract active. Inspect actual settled deliveries; future installments remain pending."
                : `Contract ${c.status}. Inspect final delivered amounts and choose another goal.`,
          });
        return output;
      },
      { isolation: "REPEATABLE READ" },
    );
  }
}
