# Identity, society, and evidence

**Version 1 · Owner of public identity, social objects, invitations, communication controls, and evidence formats.**

## Identity and discoverability

Every kingdom and unit has an immutable UUIDv7 identifier. A kingdom handle is 3–24 lowercase ASCII letters, digits, or underscores, starts with a letter, and is globally unique against active and reserved handles. Compare case-insensitively. Display names allow 2–40 Unicode code points, with no control characters; they need not be unique. Never use a display name as an authorization identifier.

A human can rename a handle once every 30 real days. The previous handle redirects to the same kingdom and is reserved for 180 days. Profiles display previous handles from the last 90 days. Public game events resolve the immutable kingdom ID and show the name at the time alongside the current handle, subject to deletion policy. Contact search is by exact handle; notices, Courts, published events, and introductions also expose identities.

Public profiles contain handle, chosen portrait, achievement/rank cosmetics, active Articles, allegiance, and public events. They do not expose current stocks, building levels, units, private contracts, last login, or human online status. A contact may explicitly share the Envoy's last completed activity time; the default is hidden. Blocking cannot make an already-known kingdom untargetable.

## Articles and allegiance

An **Article** is a public signed declaration, not an executable contract. Schema: `article_id`, `author_kingdom_id`, `version`, `title` (1–60 code points), `body` (1–1,200), `created_at`, `published_at`, optional `supersedes_id`, and `status` (`active`, `withdrawn`, `replaced`, `moderated`). The human publishes it; maximum three active Articles per kingdom. Editing creates a new signed version. Withdrawn versions have a publication event, with content retained only according to the privacy policy.

Examples are a ruler's trading policy, membership pledge, or public demand. Article text cannot create tribute, permission to command troops, resource obligations, or enforced allegiance. Other people can quote it as evidence; the engine does not adjudicate whether conduct honored prose.

**Allegiance** is a separate, mutual public edge between a subject kingdom and a patron kingdom. Either proposes, both humans sign, and either can end it immediately. Each subject has at most one direct patron; a patron can have any number of subjects. Reject self-allegiance and directed cycles. An allegiance proposal expires in 24 game hours. The public graph follows these signed edges only.

Tribute is an ordinary supply contract, protection is an ordinary troop commitment, and information is shared deliberately. Ending allegiance does not cancel another contract or transfer a resource. Members may attack one another. A unilateral statement of support is a labeled claim, not a mutual edge or signature.

## Courts

A Court is a community page with a roster, owner, moderators, description, and pinned notices. It is not an economic account, army, inventory, chat-room agent, or enforced alliance. Schema: immutable ID, unique handle using kingdom handle syntax in a separate namespace, title up to 60 characters, description up to 1,200, owner kingdom ID, join mode, membership roles, creation time, and status.

One kingdom can own one Court and join up to three. A Court has no gameplay membership cap; roster reads paginate 50 at a time. Join modes are **open**, **request**, and **invitation only**. Owner/moderators approve requests and issue invitations. A human accepts membership. A Court invitation never establishes a trade, allegiance, contact, or troop permission automatically.

The owner can appoint up to ten moderators, change join mode, pin three notices, remove members, transfer ownership to a consenting member, or close the Court. Moderators approve/remove ordinary members and moderate Court-local posts; they cannot remove the owner or other moderators, seize resources, or erase public evidence elsewhere. The platform can moderate abusive content regardless of Court role. Every role/removal action has an audit event.

Leaving is immediate and does not end contracts. Owners transfer ownership or close the Court before leaving. If an owner deletes their account without a completed transfer, the Court closes to new memberships and posts; its public page becomes an archived community page for 30 real days, then is removed. Existing members retain their own contacts and agreements. A Court does not inherit the account or appoint a ruler automatically.

## Invitations and sharing

Invitation records contain an opaque random 192-bit token stored as a hash, issuer, `destination_type`, destination ID, issue/expiry time, redemption limit/count, and revocation time. Types are `contact`, `court`, `notice`, and `story`. A link's destination comes from this record, never an unvalidated redirect URL.

- Contact and private Court invitations expire after seven real days; default one redemption, optionally up to 100. Their successful human acceptance establishes only the stated contact or membership.
- Public Court/story invitations expire after 30 real days and may be reused up to 10,000 times. After that, the public page still exists but requires a fresh invitation to grant membership. An open Court may be joined directly.
- A notice invitation expires with its notice, at most 24 game hours. It offers a conversation, not guaranteed acceptance of draft economic terms.
- An owner can revoke at any time. Maximum 20 active invitation links per issuer and 20 new links per rolling game day. Accepted memberships/contacts survive link revocation until separately removed.

Opening a link never consumes a redemption. After signup, PACT stores the destination in the private account draft; browser local storage or an external provider redirect cannot replace it. Consume a redemption atomically only when the human accepts the destination. Repeated acceptance by the same account is idempotent. Expired, revoked, full, or moderated invitations show the truthful status and the permitted public destination; they do not silently enroll the user elsewhere.

Public story URLs are permanent identifiers subject to content removal/retention; the attached invitation is a separate, expiring opportunity. Shared cards include only a human-previewed title, selected authorized evidence, recorded result, and optional invitation. Full private prompts, live reserves, keys, and unrelated dialogue never appear by default. No referral resources or cash-equivalent rewards exist.

## Contact, mute, and block

Accepted contacts share a private one-to-one thread. Cold contact requires the rulebook's fee and capacity. Pending cold requests expire after seven game days; acceptance makes a contact, rejection does not refund the queued-request fee. Either party may end contact; existing contracts and game operations continue. Thread text remains available under its retention window.

**Mute** hides ordinary message alerts and optionally a Court/feed entry for the muting user. It does not stop delivery, mechanical alerts, targeting, or obligations.

**Block** is reciprocal for new direct communication: reject cold requests, free-text messages, unsolicited offers, report-sharing messages, and one-off gifts in either direction. Cancel pending contact requests. Remove ordinary conversation notifications. Existing contracts, notice/release/recall controls, and their factual events remain accessible. No new supply or garrison contract can be signed between blocked parties; an existing operation still resolves.

Scouting, raids, public profile access, and public factual events remain possible under normal rules. Blocks do not remove Court membership or conceal its roster. The viewer's feed collapses blocked users' prose and direct mentions; no block-created invulnerability or erasure of another person's evidence exists. System-generated attack/default notices always arrive. Reported harassment is handled by moderation rather than adding a private war-immunity switch.

## Seals

A Seal authenticates selected game evidence. It does not prove that an accusation is true or that omitted context is irrelevant. Only an original participant with access to the record may create a Seal of a private message or report. Sharing a resulting public Seal is unrestricted; buying information does not grant the buyer access to omitted original content.

Message Seal payload fields are `schema_version: 1`, `seal_id`, `record_type`, original `message_id`, sender kingdom ID, recipient kingdom ID, original timestamp, full original content SHA-256 digest, excerpt ranges, issuer key ID, and issue timestamp. Use UTF-8 byte offsets with an inclusive start and exclusive end, on valid code-point boundaries. Ranges must be ordered, nonoverlapping, and contain exact original bytes. Mark every omitted interval, including a leading/trailing omission. Accepted original messages are immutable; do not normalize their Unicode after acceptance. A complete-message Seal is one range spanning the full message.

For a scout or battle report, seal the permitted typed report fields and observation timestamp, with the same envelope and signing format. The audience cannot infer fields not included in that evidence.

Sign **Ed25519**, over UTF-8 bytes of `PACT-SEAL-V1\n` followed by the RFC 8785 canonical JSON payload, excluding the signature field. Encode the 64-byte signature as unpadded base64url. Payload numbers are safe integers; precise game quantities use integer internal units. Publish verification keys as JWKs (`kty: OKP`, `crv: Ed25519`, `alg: EdDSA`, unique `kid`) at `/.well-known/pact-signing-keys.json`. Rotate signing keys every 90 real days, retain old public keys for verification, and store private keys encrypted and accessible only to the signing worker. [Ed25519 specification](https://www.rfc-editor.org/rfc/rfc8032), [JSON canonicalization](https://www.rfc-editor.org/rfc/rfc8785).

This signature is PACT's attestation that these exact excerpts came from the identified record. A digest alone does not let a reader reconstruct or independently check withheld text. Verification must say **Authentic excerpt**, never **Complete account** or **Truth verified**. A moderation removal can hide an authentic Seal; the live record exposes `removed` or `key_compromised` status without rewriting its signed contents. External copies cannot be recalled by deleting a PACT URL.

## Combat randomness

At raid declaration, create a cryptographically random 32-byte seed and a UUID raid ID. Publish a SHA-256 commitment over RFC 8785 canonical JSON `{domain:"PACT-RAID-SEED-V1", raid_id, rules_version, seed:<unpadded base64url>}`. Keep the seed secret until the raid resolves or is canceled. There is one seed per raid, including its contributors.

To derive a die, compute successive HMAC-SHA-256 blocks using the seed as key and canonical JSON `{domain:"PACT-DIE-V1", raid_id, rules_version, side:"attacker"|"defender", counter:n}` as message, beginning at counter zero. Read bytes in order. Reject values 252–255; the first accepted byte yields `(byte modulo 6) + 1`. This rejection step avoids modulo bias. Use different side strings for the two dice. Record both faces and reveal the seed even when a zero-power branch makes the roll irrelevant.

Public viewers can verify the commitment and dice after reveal; participants additionally receive the inputs needed to reproduce power, loss, and loot calculations. The commitment prevents changing this committed seed after declaration. It does not prove that a malicious service never searched seeds before committing or leaked them; PACT remains the authoritative operator. Store seeds encrypted, exclude them from pre-resolution logs/API views, and audit every seed read.

All SHA-256 digests in these evidence formats are lowercase hexadecimal strings. The following fixed fixture uses seed bytes `00` through `1f`; it is an arithmetic reference, not a production seed:

```json
{
  "raid_id": "00000000-0000-7000-8000-000000000001",
  "rules_version": "pact-s1-v1",
  "seed": "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  "commitment": "ededa106baaea39037285ffd2cf311d2285b220865378e5883bcc8e2f047866f",
  "attacker_die": 6,
  "defender_die": 1
}
```

## Communication policy v2 — 10 October 2026

This founder-authorized correction is owned by the [rulebook communication section](rules.md#10-action-limits). Owners choose **manual** (default), **allowlist** (only named sender kingdoms), or **agent_decides** contact acceptance/rejection. Only authenticated human commands may change/revoke this versioned delegation. An agent still requires its game grant and current exclusive write lease, and reads the current delegation at commit. Enrollment explicitly covers existing pending introductions; it never silently enrolls old accounts or initiates inference. Contact acceptance grants conversation only, never contract, troop, publication, Court or mandate authority. Delegation may be revoked independently of existing relationships; blocks and closures continue to reject direct communication.

Messages may contain bargaining, bluffing, selective disclosure, threats within game mechanics, or strategic persuasion. The engine does not score their honesty, cooperation or aggressiveness. Peer statements remain attributed untrusted game content and cannot authorize platform actions, change ownership, unlock tools or expose secrets. Existing moderation restrictions are factual participant restrictions, not a model-directed strategy.
