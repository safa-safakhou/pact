# Source-backed evidence Seals

PACT-058: `SealService` in the kingdom module, generic `@pact/evidence` canonicalization/UTF-8/Ed25519 primitives, and the separate `SealSigner` process in the rules-worker workspace. Migration `0040_evidence_seals.sql` owns public records, encrypted signing keys and source-removal tombstones. No new server, model calls, paid dependencies or automatic inference.

## Human preview and publication

Chronicle **Evidence Seals** previews authorized messages/scout/battle reports. People messages and Chronicle reports have **Seal this message/report** links, selecting the real original ID. Empty selection means the full permitted source. Optional message ranges are a JSON array such as `[[0,12],[20,28]]` of UTF-8 byte offsets; report selection is a field-name list such as `["wallLevel"]`. Preview displays the exact selected text/typed fields, every omitted interval/field, original real timestamp, report observation game time and named kingdoms. Changing any selection clears approval. Publication requires the human's exact review checkbox. Text is escaped as untrusted player content.

`POST /v1/seals/preview` uses the existing human cookie, Origin and CSRF checks. Strict selection shapes:

```json
{"recordType":"message","recordId":"00000000-0000-4000-8000-000000000001","ranges":[{"start":0,"end":12}]}
```

`recordType: scout | battle` instead takes optional `fields`. This read-only endpoint returns `payload`, `previewDigest`, `participants` and a publication warning. Only sender/recipient may select a message; only the original scout may attest its report. A recipient/purchaser of a shared scout report may still read it but cannot seal the original. Battle access delegates to the same participant reader used by game reports. Public report availability alone grants no sealing right. Caller ownership fields and nonexistent/private/expired/hidden sources fail; accepted message bytes are never normalized.

Human `POST /v1/social/commands` uses additive immutable `pact.seal-command.v1`:

```json
{"schemaVersion":"pact.seal-command.v1","commandId":"00000000-0000-4000-8000-000000000002","action":{"kind":"seal.publish","selection":{"recordType":"message","recordId":"00000000-0000-4000-8000-000000000001","ranges":[{"start":0,"end":12}]},"previewDigest":"<actual SHA-256 from preview>"}}
```

This re-reads/re-authorizes the immutable source and recomputes the exact preview digest. Changed contents/selections cannot use an old review. There is no caller-provided excerpt body for the server to trust. Shared world admission atomically commits selected evidence, the six-publications/game-day `public_post` allowance, receipt and outbox. Articles, Court pins and Seals share that allowance. No stocks, troop rights, contracts or truth judgments are created. Agent publication is forbidden. `seal.remove` with `sealId` hides the creator's hosted Seal immediately, including queued records; it does not consume publication allowance.

`COMMITTED` means a durable **pending** publication, not a finished signature. Result is `{sealId,status}`; receipt recordVersions contains `seal:<id>`. Retry the same ID/payload; replay gives the same receipt and `result:null`, so recover the ID from recordVersions. Different terms with the old ID conflict. A worker/key failure leaves evidence pending and public contents unavailable. Refresh its status; never republish under a new ID merely because signing is delayed.

## Signing and verification

The worker adds seal ID, issuer key ID and issue timestamp to the reviewed payload and signs UTF-8 `PACT-SEAL-V1\n` plus RFC 8785 canonical JSON (signature excluded). Numbers are safe integers; exact quantities retain internal-unit strings from authorized report types. Ordered UTF-8 ranges start inclusive/end exclusive on code-point boundaries, with no overlap/reordering. Leading, middle and trailing omissions are explicit. The digest covers the whole original message/report, but does not let public readers reconstruct withheld contents.

Reusable helpers follow the [RFC 8785 canonicalization rules](https://www.rfc-editor.org/rfc/rfc8785): UTF-16 object-key ordering, preserved array order/Unicode and JSON primitive encoding, rejecting invalid Unicode/non-JSON/unsafe numbers. Ed25519 is checked against [RFC 8032 section 7.1 test 1](https://www.rfc-editor.org/rfc/rfc8032.html#section-7.1) and altered/domain-mismatched signatures. These are implementation tests, not an independent security certification.

`GET /v1/seals/:sealId` and scoped MCP `pact_seal_read_v1` return the same selected payload, 64-byte unpadded base64url signature, public JWK and actual verification result. Label is **Authentic excerpt**, never proof of truth or a complete account. Other players' assertions and agent assessments remain separate from engine facts. The guide explains the tool and human handoff. There is deliberately no original-source download endpoint. Pending status is creator-only; public viewers receive `found:false` until signed.

`GET /.well-known/pact-signing-keys.json` publishes JWKs with kty OKP, crv Ed25519, alg EdDSA and unique kid; no private `d` field or ciphertext. Old public keys are retained. `compromisedKeyIds` separately lists flagged IDs; the live viewer returns `key_compromised` without contents. Automated 90-day rotation and compromised-key operational certification are explicitly deferred by Alpha, not claimed complete.

## Process, retention and recovery

Run `npm run start:seals --workspace @pact/rules-worker` after building/migrating. `DATABASE_URL` and a dedicated, canonical-base64 32-byte `SEAL_ENCRYPTION_KEY_BASE64` belong only to this signing process. Initialization serializes key creation, generates Ed25519, and stores its PKCS8 private key encrypted with AES-256-GCM (fresh nonce; scope/kid bound as associated data). Only the worker decrypts it in memory; the API loads no private capability. Boundary checks reject that capability in other services/workers. Never print/commit wrapping keys, private keys or real private evidence. Losing the wrapping key does not invalidate already signed public copies, but prevents pending signing with the encrypted key. Restore it; do not silently replace it. Each signing transaction leases a pending row with `SKIP LOCKED`, commits signature and factual publication outbox together, and tolerates retry without duplicate publication.

The same-VPS Compose service mounts only PostgreSQL and Seal-wrapping secrets. Deployment creates an absent wrapping file with mode 0600 and never overwrites an existing one; see [VPS runbook](../operations/vps-deployment.md). Rollback stops signing if the older image lacks its entry point; pending records remain. This code change does not itself deploy anything.

Private message sources expire after 90 real days; reports after 180. Public excerpts are separate records, available for at most 180 real days from creation. Expiring an original does not resurrect it or expose omitted bytes. Creator removal and `hideSource` (internal module port, not an agent/public moderation command) hide hosted contents immediately. Source tombstones also cancel pending signing and reject new previews. Account-erasure hooks hide and scrub excerpts involving the retiring participant, including another issuer's copy; own exports contain only owned available publications. Daily privacy owner pruning deletes expired Seal content and old source tombstones; active signing/public verification keys remain. External copies cannot be recalled. Full platform case tooling is later, and this is not PACT-064 certification.

PACT-059 can attach only public selected Seals to Chronicle stories. PACT-061 owns comprehensive UI/browser rehearsal; PACT-099 owns richer agent proposal/activity orchestration; PACT-080 owns observed independent agent play.
