# Executable operation contract source acceptance

AR-P02 / PACT-172 and AR-F02, 15 October 2026. Source/offline only; no deployment or real inference.

PACT publishes additive reviewed `pact.operation-catalog.v1` metadata on authenticated catalogs and shared MCP descriptors: exact name, argument contract, required scopes, agent audience, read/write classification and final server recheck. Product scope is checked at dispatch as well as catalog discovery. Invalid arguments retain the existing error code and bounded field/code/schema diagnostics without copying submitted values. MCP transports preserve those safe diagnostics. Frozen v1 published schemas and economics remain unchanged.

Fleet binds each selected operation name/kind to its exact argument schema in the generation contract; all other admitted operations have exact, closed schema-lookup routes. Current correction feedback selects the relevant action schema, and recent lookups activate current contracts only. The provider receives one schema rather than duplicate prompt copies. Cognitive evidence IDs remain separate from executable target IDs; unreachable decision definitions and nonassertion schema annotations are omitted. Local validation and final PACT authority remain mandatory.

| Acceptance | Evidence | Result |
| --- | --- | --- |
| Four malformed calls plus legitimate building | Closed generation tests reject invented conversation names, wrong argument names, missing body and extra action summary; valid building passes | Pass |
| Precise correction within existing decisions | Fake engine receives closed schema once; invented tool is rejected locally and corrected read runs; action lookup exposes a legitimate six-hour zero-notice offer | Pass |
| Scope/version/schema compatibility | PACT authenticated dispatch/catalog tests, metadata contracts, Fleet legacy/current/unsupported catalog and malformed action schema controls | Pass |
| Portability and privacy | Generic second-game engine test, no PACT imports in core, bounded safe remote diagnostics | Pass |
| Full packet and cognition compatibility | Existing dense cognition test measures messages plus schema <=24,000 bytes, ordered accepted recall evidence, explicit optional-state omission and persisted update; eight UUID-order variations passed | Pass |

PACT: full build/typecheck/lint, 369 unit tests and 62 relevant integration tests (MCP approval inbox, social commands, A2A) pass; published v1 freeze remains 26/26. Fleet: check/build/boundaries, 116 unit and all 169 integration tests pass. Existing lint warnings remain. Isolated disposable test databases and fake model/helper/game ports only; no real provider qualification is implied. API-compatible endpoint support for the full schema is a separate AR-F10 qualification gate; the route must not assert unsupported strict-subset compatibility. Ollama's native schema transport remains intact.

This batch does not solve semantic target roles, packet prioritization, durable plans, authoritative admission quotes or credentials; those retain their own dependency-ordered tasks. No live account permissions, schedules, budgets, history or releases changed.

Additional delivery controls verify the accepted recall pair reaches the model in selected order with original source identity/time/kind and direction/peer or command/outcome linkage. Optional plan, belief and reflection omissions are explicit and those records remain stored. A fake-provider native reassessment requiring an omitted belief fails the delivered generation schema and normalization; canonical reflection with a missing prior expectation and memory citing an omitted source are refused without state/version mutation. The fixed serialized 24,000-byte cap is unchanged.
