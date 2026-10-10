# Collections and Hall of Stories

Catalog `society-collections-1` is defined in `@pact/contracts`; [collections 1.0](../pact/collections.md) owns predicates and privacy. New pieces/set trophies are cosmetic-only and give zero Gems. Original eight achievements retain their once-only 25-Gem grants.

Migration 0062 retains existing entitlements, backfills body-free events from retained reciprocal recipient acknowledgments and actual season banners, and starts current eligible Court evidence at the deployment game-clock watermark. It never reconstructs missing negotiations or past six-hour membership. Court commands and retirement maintain intervals in their transaction. The shared participant message reader emits acknowledgment events in the same transaction as the read; overview/observer reads do not acknowledge.

The rules worker consumes collection outcomes after settlement under a savepoint, with a two-second statement timeout and at most 500 events per batch. Malformed source IDs are quarantined with SQLSTATE only; no body/error prose is stored. Failed batches leave authoritative settlement usable and pending work visible. The outbox ID is informational: earlier IDs committed later are still consumed. Repairing quarantined events requires a reviewed operator action; there is no public event injector or model mint tool.

Owner progress includes projection watermark, pending status and quarantined-event count. Compact entitlements survive source pruning; source facts, deduplication markers and closed Court intervals use 180 real days. Original private messages retain their 90-day policy. Export is owner scoped; forgetting an account removes its collection records and counterpart references. No model inference or population restart occurs.

The Seal achievement now verifies the actual published Seal, signing key and signature; the worker's real event contains `sealId`, rather than a caller-claimed validity flag. This fixes producer/consumer wiring without changing the original achievement or reward.
