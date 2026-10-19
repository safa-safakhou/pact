# Private kingdom ambition

Human PATCH /v1/kingdom/ambition with the session cookie, exact Origin and x-csrf-token. Body is strictly `{ambition: string}` with at most8,000 characters; empty string explicitly clears guidance; account/kingdom identity comes from the authenticated cookie. Requires a ranked kingdom. This route is not an agent tool and starts no inference.
Owner world reads and pact_agent_guide_v1 expose the current free-form owner guidance; public/contact/participant projections exclude it. Guidance only: no resource, permissions or scoring effect.
Migration0045 applies automatically with existing migrations. Kingdom-owned privacy hook exports this field and clears it on deletion/restore suppression; retirement clears it immediately. Missing/null means neutral.

# Owner resource facts and result presentation

Owner HTTP world reads and pact_world_read_v1 return balances[resource].facts with ordinaryWhole, allowanceWhole, lockedWhole, capacityWhole and rates. Each gross/upkeep/net rate contains perMinuteWhole, perHourWhole and the shared human label. Marked stock fields are unchanged at600 marked units per whole. Nonterminating decimals use an approximation marker. Grain gross respects current harvest; net subtracts troop upkeep and excludes trade, overflow and allowance expiry. Forecast.expected is ending stock, not a change; forecast.assumption retains conditional settlement assumptions.

The web consumes the same facts, with an explicit unavailable fallback for old responses. Bounded in-app owner snapshots retain raw balances plus the shared rate labels instead of duplicating every formatted field. Truncated tool outputs explicitly inventory omitted fact groups: missing means unknown, not zero.

Envoy factual result summaries select only authorized result/current-record metadata. They show private ambition, latest receipt outcome, current decision and next step. Current exact pending approval takes priority; stale views suppress decision links. Agent commentary is labeled interpretation and cannot establish completion or permission. All display reads are free of inference.

## Next-decision presentation
Human-cookie GET /v1/approvals returns up to ten live pending approvals for the authenticated account and a truncated flag. It ignores caller ownership fields, excludes expired/terminal records, exposes existing review links, and never admits or executes commands. Agent bearer credentials do not grant this human read.
Owner GET /v1/game/social includes up to ten newest outgoing requestHistory entries with actual recorded status, public peer identity, and game deadline; private notes are omitted from history. The ordinary pending requests projection is preserved. A crossed deadline remains pending until the server records otherwise.
The web decision card orders current approval, latest failed action, pending recipient, current build, next choice. Unknown/stale reads prevent absence or completion claims. Construction comparisons reuse the domain catalog and distinguish founding allowance from ordinary stock. Countdown rendering does not settle builds.

## Static settlement art
KingdomScene consumes only the owner view's completed buildings and current builder records. Active non-null instructions draw static scaffolding. It never reads a timer, advances progression, or calls an action. Farm/Mine level2 select their distinct static export; higher levels retain factual native numbers and marked base illustration. Missing media leave names, levels, resources and controls readable. Files are shared static paths without owner parameters; public projections do not render this component.
Regenerate vectors with python3 assets/experience/generate_scene.py. The texture is a256px mechanical export of the preserved original in assets/experience/proof/parchment.png; source prompt/provenance are preserved.

## Cosmetic preferences and playback
ExperienceControls is mounted once per owner above game areas. Every page session starts disabled until Enable sound receives a human gesture, even when volume preferences were saved. Browser storage keys pact_experience:<kingdomId> contain only presentation settings; switching player, authenticated signout/closure and detected identity change clear them. No commands, quotas, grants or inference are touched.
ExperienceAudio owns one instance per music/ambience loop, pauses on document visibility, disposes playback on unmount, consumes observed event keys while silent/hidden and never queues cues for return. Event cooldown is3000ms; manual preview cooldown10000ms. Notification and effects volumes multiply for event cues; manual preview uses effects volume only. Final cue/art integration belongs to119/124; current manual preview uses a bounded800ms flourish excerpt pending118's final honk.
Humour hides marked flavour and manual gag; factual cards remain. Motion follows OS unless explicitly on/off, via root data attributes and static CSS. Storage failure falls back to defaults. All final117/118 files are integrated. Founder accepted the proof/effects as clean and tentatively accepted the contextual music/ambience/flourish preview; this is not a measured enjoyment result.

## Cosmetic court asset pack
Four original presenters have three poses each under public/experience/characters. All are decoration, never kingdom identities or command participants. Sixteen short lines are under copy.json characters. Factual status must be separate from marked flavour; disabling humour hides only decoration. Review page demonstrates this using explicitly synthetic status. PACT-119 owns real outcome attachment.
Preserved originals and reference prompts are under assets/experience/characters. Mechanical exports reproduce with Python/Pillow12.3 via export_characters.py; bundled Windows Python includes Pillow. Imagegen prompts/references preserve provenance rather than promising identical newly generated originals.

Confirmed milestone motion uses owner completed/accepted/positive-delivery keys, primes existing history silently, and observes reduced motion. Public harvest fields use only the authoritative six-week 100/100/90/80/80/100 schedule, never private hunger. Notice dates are actual published/expiry fields or explicit unknown; outgoing requests show recorded state, never inferred acceptance or predicted response time. Seven original event WAVs are available with captions; their actual contextual mapping belongs to PACT-119.

PACT-119 Recorded game moments consume only fresh authorized owner projections and current supply offers. Seven templates link existing source routes with the record ID beside each link. No endpoint/store/channel is introduced. Completed builds, accepted contacts and positive recorded contract delivery reuse milestone dedup keys; signatures use offer/version/signer; warnings use threat/phase; defaults use terminal contract ID. Existing history and stale reconnects remain silent. Waiting cannot play or celebrate. Humour controls hide only cosmetic portraits/lines, keeping native consequences and record links. The development contextual preview lives at /experience-context.html and clearly labels its synthetic fixtures; production remains the normal GameApp entry.

Owner consequences now include firstRetained: build/contact/delivery nullable records {recordId, occurredGameTimeMs, summary}. These are selected from all currently retained authorized rows in the same owner snapshot, independent of latest-20 pagination. A positive delivery is required; queued builds and proposals do not qualify. Earliest retained does not reconstruct purged history. Public/outsider projections omit consequences as before. Hall keepsakes are read-only displays with stable dates and IDs, without entitlements or a new store.


Record links in outcome, Hall and legacy milestone cards use the registered authorized GET /v1/world/kingdoms/:kingdomId route. Owner identity remains server-derived; public requests receive only the public projection. Missing/stale data never fabricates a keepsake.

Final testing-world review and operational boundaries are documented in ../implementation/reports/experience-fresh-player-20261003.md. The standard existing-VPS build includes public assets; the contextual Vite development entry is not a shipped production entry. The testing release is experience-20261003-4, migration0045.
