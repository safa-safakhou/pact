import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  generateKeyPairSync,
  type JsonWebKey,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { appendOutbox, withTransaction } from "@pact/db";
import { signPayload } from "@pact/evidence";
import { SEAL_DOMAIN } from "@pact/kingdom";
import type { Pool } from "pg";

/** Private-key capability lives exclusively in the separate signing worker. API receives public keys only. */
export class SealSigner {
  constructor(
    private readonly pool: Pool,
    private readonly scope: string,
    private readonly wrappingKey: Buffer,
    private readonly clock: { now(): Date },
  ) {
    if (wrappingKey.length !== 32) throw new Error("INVALID_SEAL_WRAPPING_KEY");
  }
  async initialize() {
    return withTransaction(this.pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`pact.seal-key:${this.scope}`]);
      if (
        (await client.query("SELECT 1 FROM seal_signing_keys WHERE product_scope=$1 AND active", [this.scope])).rowCount
      )
        return;
      const { privateKey, publicKey } = generateKeyPairSync("ed25519"),
        kid = `seal-${randomUUID()}`,
        iv = randomBytes(12);
      const plaintext = privateKey.export({ type: "pkcs8", format: "der" });
      const cipher = createCipheriv("aes-256-gcm", this.wrappingKey, iv);
      cipher.setAAD(Buffer.from(`${this.scope}:${kid}`));
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      plaintext.fill(0);
      const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "EdDSA", use: "sig" };
      await client.query(
        "INSERT INTO seal_signing_keys(kid,product_scope,public_jwk,encrypted_private_key,created_at) VALUES($1,$2,$3::jsonb,$4,$5)",
        [kid, this.scope, JSON.stringify(jwk), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), this.clock.now()],
      );
    });
  }
  async signNext(): Promise<string | null> {
    return withTransaction(this.pool, async (client) => {
      const row = (
        await client.query<{
          id: string;
          preview_payload: Record<string, unknown>;
          creator_kingdom_id: string;
          record_type: string;
          record_id: string;
          created_at: Date;
        }>(
          "SELECT * FROM evidence_seals WHERE product_scope=$1 AND status='pending' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
          [this.scope],
        )
      ).rows[0];
      if (!row) return null;
      const hidden = (
        await client.query(
          "SELECT 1 FROM seal_source_removals WHERE product_scope=$1 AND record_type=$2 AND record_id=$3 UNION ALL SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM kingdoms WHERE product_scope=$1 AND id=$4 AND status='ranked')",
          [this.scope, row.record_type, row.record_id, row.creator_kingdom_id],
        )
      ).rowCount;
      if (hidden || row.created_at.getTime() <= this.clock.now().getTime() - 180 * 86400000) {
        await client.query("UPDATE evidence_seals SET status='removed' WHERE id=$1", [row.id]);
        return row.id;
      }
      const stored = (
        await client.query<{ kid: string; public_jwk: JsonWebKey; encrypted_private_key: Buffer }>(
          "SELECT kid,public_jwk,encrypted_private_key FROM seal_signing_keys WHERE product_scope=$1 AND active AND NOT compromised FOR SHARE",
          [this.scope],
        )
      ).rows[0];
      if (!stored) throw new Error("SEAL_SIGNING_KEY_UNAVAILABLE");
      const box = stored.encrypted_private_key,
        decipher = createDecipheriv("aes-256-gcm", this.wrappingKey, box.subarray(0, 12));
      decipher.setAAD(Buffer.from(`${this.scope}:${stored.kid}`));
      decipher.setAuthTag(box.subarray(12, 28));
      const plaintext = Buffer.concat([decipher.update(box.subarray(28)), decipher.final()]);
      let signature: string;
      const issued = this.clock.now(),
        payload = {
          ...row.preview_payload,
          seal_id: row.id,
          issuer_key_id: stored.kid,
          issue_timestamp: issued.toISOString(),
        };
      try {
        signature = signPayload(
          SEAL_DOMAIN,
          payload,
          createPrivateKey({ key: plaintext, type: "pkcs8", format: "der" }),
        );
      } finally {
        plaintext.fill(0);
      }
      await client.query(
        "UPDATE evidence_seals SET status='published',signed_payload=$2::jsonb,signature=$3,kid=$4,published_at=$5 WHERE id=$1",
        [row.id, JSON.stringify(payload), signature, stored.kid, issued],
      );
      await appendOutbox(client, {
        eventId: randomUUID(),
        productScope: this.scope,
        type: "seal.published.v1",
        payload: { sealId: row.id },
      });
      return row.id;
    });
  }
}
