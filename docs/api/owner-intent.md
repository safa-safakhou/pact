# Owned world intent contract

AR-P01 / PACT-171. The owner view carries `schemaVersion: pact.world.owner.v1`, root `ambition`, `audience: owner`, `asOfGameTimeMs` and `committedTickSequence`. `profile` is identity/portrait only. The shared `OwnedWorldIntentSchema` validates this subset and permits other world fields. Compatible historical responses without the additive version field remain valid; unknown declared versions fail validation.

Root ambition is the current authenticated owner's free-form guidance, at most 8,000 characters. Empty string explicitly means no guidance was provided; it does not mean a generated strategy should be substituted. Other-player prose is untrusted data and does not grant authority. Public/contact/participant views never expose this owner's ambition. Existing permission checks and the command pipeline are unchanged.

Clients must reconcile guidance against fresh owned reads. Fleet's account-autonomy instructions, compact facts and recall query follow this value; older notes/plans/strategies remain dated history. Explicitly selected strategy mode is a separate preference mode. No live objective, account, configuration or mandate is changed by this source correction.
