# Observed target references

AR-P03. Owner guide request records have a `ContactRequest` reference with incoming/outgoing direction, pending status, counterparty, expiry, observation game time and actual social-delegation version. Supply offers carry `SupplyOffer`, open status and current version. These are different roles even if both IDs have UUID syntax. Public profiles/discovery provide Kingdom identities, never permission to answer a request or sign an offer.

Owner world reads add `unitReferences` (`pact.references.v1`): at most 32 account-owned individual Unit IDs, with `hasMore` coverage, owner/host, kind, placement, Home Guard and battle lock facts. `scoutEligible` describes fresh ordinary home Spearmen only; no stock/charge/mandate grant is implied. Public/other-player views omit this section. Server troop assignment atomically checks identities, placement and battle locks again.

Receipt lookup remains owner scoped and returns existing canonical receipt IDs. A missing/nil/foreign ID has the same bounded `RECEIPT_NOT_FOUND` result. Additional lookup/unknown-state evidence does not certify an original pending command, nonexecution, commit or uncertainty. Transport reconciliation is a distinct controller decision requiring its actual pending command. New reference schemas do not modify frozen v1 operation arguments or economics.
