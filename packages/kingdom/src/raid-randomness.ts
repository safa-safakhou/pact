import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

export type RaidSide = "attacker" | "defender";
export type RaidSeedStatus = "committed" | "resolved" | "canceled";

export interface RaidCommitment {
  raidId: string;
  rulesVersion: string;
  commitment: string;
  status: RaidSeedStatus;
}

export interface RaidReveal extends RaidCommitment {
  status: "resolved" | "canceled";
  seed: string;
  attackerDie: number;
  defenderDie: number;
}

function checkSeed(seed: Uint8Array): void {
  if (seed.byteLength !== 32) throw new Error("RAID_SEED_LENGTH");
}

function checkIdentity(raidId: string, rulesVersion: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raidId))
    throw new Error("INVALID_RAID_ID");
  if (!rulesVersion || rulesVersion.length > 80) throw new Error("INVALID_RULES_VERSION");
}

/** These fixed-schema, ASCII-key payloads are serialized in RFC 8785 key order. */
export function raidCommitment(seed: Uint8Array, raidId: string, rulesVersion: string): string {
  checkSeed(seed);
  checkIdentity(raidId, rulesVersion);
  const payload = JSON.stringify({
    domain: "PACT-RAID-SEED-V1",
    raid_id: raidId,
    rules_version: rulesVersion,
    seed: Buffer.from(seed).toString("base64url"),
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function raidDie(seed: Uint8Array, raidId: string, rulesVersion: string, side: RaidSide): number {
  checkSeed(seed);
  checkIdentity(raidId, rulesVersion);
  if (side !== "attacker" && side !== "defender") throw new Error("INVALID_RAID_SIDE");
  for (let counter = 0; counter < Number.MAX_SAFE_INTEGER; counter += 1) {
    const payload = JSON.stringify({
      counter,
      domain: "PACT-DIE-V1",
      raid_id: raidId,
      rules_version: rulesVersion,
      side,
    });
    const block = createHmac("sha256", seed).update(payload, "utf8").digest();
    const die = fairDieFromBytes(block);
    if (die !== null) return die;
  }
  throw new Error("RAID_DIE_EXHAUSTED");
}

/** Returns null only when every byte is rejected; the caller must request another HMAC block. */
export function fairDieFromBytes(bytes: Iterable<number>): number | null {
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new Error("INVALID_DIE_BYTE");
    if (byte < 252) return (byte % 6) + 1;
  }
  return null;
}

export function verifyRaidReveal(input: RaidReveal): boolean {
  try {
    if (input.status !== "resolved" && input.status !== "canceled") return false;
    const seed = Buffer.from(input.seed, "base64url");
    if (seed.toString("base64url") !== input.seed || seed.byteLength !== 32) return false;
    return (
      raidCommitment(seed, input.raidId, input.rulesVersion) === input.commitment &&
      raidDie(seed, input.raidId, input.rulesVersion, "attacker") === input.attackerDie &&
      raidDie(seed, input.raidId, input.rulesVersion, "defender") === input.defenderDie
    );
  } catch {
    return false;
  }
}

interface SeedRow {
  raid_id: string;
  rules_version: string;
  commitment: string;
  status: RaidSeedStatus;
  seed_ciphertext: Buffer;
  seed_nonce: Buffer;
  seed_auth_tag: Buffer;
  revealed_seed: string | null;
}

function aad(productScope: string, raidId: string, rulesVersion: string): Buffer {
  return Buffer.from(JSON.stringify({ productScope, raidId, rulesVersion }), "utf8");
}

/** Transaction-bound seed store. Only the future raid worker may call reveal after validating resolution/cancellation. */
export class RaidRandomnessService {
  private readonly key: Buffer;

  constructor(
    private readonly productScope: string,
    encryptionKey: Uint8Array,
    private readonly entropy: (size: number) => Uint8Array = randomBytes,
  ) {
    if (encryptionKey.byteLength !== 32) throw new Error("RAID_ENCRYPTION_KEY_LENGTH");
    this.key = Buffer.from(encryptionKey);
  }

  async declare(client: PoolClient, raidId: string, rulesVersion: string): Promise<RaidCommitment> {
    checkIdentity(raidId, rulesVersion);
    const existing = await client.query<SeedRow>(
      `SELECT raid_id, rules_version, commitment, status FROM raid_seed_commitments
       WHERE product_scope = $1 AND raid_id = $2`,
      [this.productScope, raidId],
    );
    if (existing.rows[0]) return this.publicCommitment(existing.rows[0], rulesVersion);
    const seed = Buffer.from(this.entropy(32));
    checkSeed(seed);
    try {
      const commitment = raidCommitment(seed, raidId, rulesVersion);
      const nonce = Buffer.from(this.entropy(12));
      if (nonce.byteLength !== 12) throw new Error("RAID_NONCE_LENGTH");
      const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
      cipher.setAAD(aad(this.productScope, raidId, rulesVersion));
      const ciphertext = Buffer.concat([cipher.update(seed), cipher.final()]);
      const inserted = await client.query<SeedRow>(
        `INSERT INTO raid_seed_commitments(raid_id, product_scope, rules_version, commitment,
           seed_ciphertext, seed_nonce, seed_auth_tag)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (raid_id) DO NOTHING
         RETURNING raid_id, rules_version, commitment, status`,
        [raidId, this.productScope, rulesVersion, commitment, ciphertext, nonce, cipher.getAuthTag()],
      );
      if (inserted.rows[0]) return this.publicCommitment(inserted.rows[0], rulesVersion);
      const winner = await client.query<SeedRow>(
        `SELECT raid_id, rules_version, commitment, status FROM raid_seed_commitments
         WHERE product_scope = $1 AND raid_id = $2`,
        [this.productScope, raidId],
      );
      if (!winner.rows[0]) throw new Error("RAID_ID_SCOPE_CONFLICT");
      return this.publicCommitment(winner.rows[0], rulesVersion);
    } finally {
      seed.fill(0);
    }
  }

  async publicEvidence(client: PoolClient, raidId: string): Promise<RaidCommitment | RaidReveal> {
    const result = await client.query<SeedRow>(
      `SELECT raid_id, rules_version, commitment, status, revealed_seed
       FROM raid_seed_commitments WHERE product_scope = $1 AND raid_id = $2`,
      [this.productScope, raidId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RAID_SEED_NOT_FOUND");
    if (row.status === "committed" || !row.revealed_seed) return this.publicCommitment(row, row.rules_version);
    return this.revealFromRow(row);
  }

  async revealedEvidence(client: PoolClient, raidId: string): Promise<RaidReveal> {
    const evidence = await this.publicEvidence(client, raidId);
    if (evidence.status === "committed") throw new Error("RAID_NOT_REVEALED");
    return evidence as RaidReveal;
  }

  async reveal(
    client: PoolClient,
    input: { raidId: string; purpose: "resolve" | "cancel"; actorRef: string },
  ): Promise<RaidReveal> {
    if (!input.actorRef.trim()) throw new Error("RAID_SEED_ACTOR_REQUIRED");
    const result = await client.query<SeedRow>(
      `SELECT * FROM raid_seed_commitments WHERE product_scope = $1 AND raid_id = $2 FOR UPDATE`,
      [this.productScope, input.raidId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RAID_SEED_NOT_FOUND");
    const target = input.purpose === "resolve" ? "resolved" : "canceled";
    if (row.status !== "committed") {
      if (row.status !== target) throw new Error("RAID_ALREADY_TERMINAL");
      return this.revealFromRow(row);
    }
    await client.query(
      `INSERT INTO raid_seed_access_audit(product_scope, raid_id, purpose, actor_ref) VALUES ($1,$2,$3,$4)`,
      [this.productScope, input.raidId, input.purpose, input.actorRef],
    );
    const decipher = createDecipheriv("aes-256-gcm", this.key, row.seed_nonce);
    decipher.setAAD(aad(this.productScope, row.raid_id, row.rules_version));
    decipher.setAuthTag(row.seed_auth_tag);
    const seed = Buffer.concat([decipher.update(row.seed_ciphertext), decipher.final()]);
    try {
      checkSeed(seed);
      if (raidCommitment(seed, row.raid_id, row.rules_version) !== row.commitment)
        throw new Error("RAID_SEED_COMMITMENT_MISMATCH");
      const revealedSeed = seed.toString("base64url");
      await client.query(
        `UPDATE raid_seed_commitments SET status = $3, revealed_seed = $4, revealed_at = clock_timestamp()
         WHERE product_scope = $1 AND raid_id = $2`,
        [this.productScope, input.raidId, target, revealedSeed],
      );
      return this.revealFromRow({ ...row, status: target, revealed_seed: revealedSeed });
    } finally {
      seed.fill(0);
    }
  }

  private publicCommitment(row: SeedRow, rulesVersion: string): RaidCommitment {
    if (row.rules_version !== rulesVersion) throw new Error("RAID_RULES_VERSION_CONFLICT");
    return { raidId: row.raid_id, rulesVersion, commitment: row.commitment, status: row.status };
  }

  private revealFromRow(row: SeedRow): RaidReveal {
    if (!row.revealed_seed || row.status === "committed") throw new Error("RAID_NOT_REVEALED");
    const seed = Buffer.from(row.revealed_seed, "base64url");
    return {
      raidId: row.raid_id,
      rulesVersion: row.rules_version,
      commitment: row.commitment,
      status: row.status,
      seed: row.revealed_seed,
      attackerDie: raidDie(seed, row.raid_id, row.rules_version, "attacker"),
      defenderDie: raidDie(seed, row.raid_id, row.rules_version, "defender"),
    };
  }
}
