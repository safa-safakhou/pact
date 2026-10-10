import type { PoolClient } from "pg";
/** Metadata-only transaction port. No decryption, provider/network call or scope expansion. */
export async function storedCredentialRouteAvailable(
  client: PoolClient,
  scope: string,
  accountId: string,
  credentialId: string,
  provider: string,
): Promise<boolean> {
  return Boolean(
    (
      await client.query(
        "SELECT 1 FROM model_connections WHERE product_scope=$1 AND account_id=$2 AND id=$3 AND provider=$4 AND revoked_at IS NULL AND credential_ciphertext IS NOT NULL",
        [scope, accountId, credentialId, provider],
      )
    ).rowCount,
  );
}
