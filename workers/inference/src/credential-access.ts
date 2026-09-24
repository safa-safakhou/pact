import { CredentialResolver, CredentialVaultError, RsaOaepPrivateKeyUnwrapper } from "@pact/credential-vault";
import { ProviderError } from "@pact/model-provider";
import type { Pool } from "pg";

export interface InferenceCredentialAccessOptions {
  readonly productScope: string;
  readonly privateKeyPem: string | Uint8Array;
  readonly acceptedKeyIds: ReadonlySet<string>;
  readonly now: () => Date;
}

/**
 * The inference process is the sole composition root for credential unwrapping.
 * Callers supply private key bytes from an inference-only secret mount.
 */
export function createInferenceCredentialResolver(
  pool: Pool,
  options: InferenceCredentialAccessOptions,
): CredentialResolver {
  return new CredentialResolver(pool, {
    productScope: options.productScope,
    clock: { now: options.now },
    unwrapper: new RsaOaepPrivateKeyUnwrapper(options.privateKeyPem, options.acceptedKeyIds),
  });
}

/** Keep decrypted bytes inside the vault's admitted use, and bind the stored provider to the run route. */
export function createVaultBoundCredentialUse(resolver: CredentialResolver) {
  return <T>(
    accountId: string,
    credentialId: string,
    provider: string,
    operation: (credential: Uint8Array) => Promise<T>,
  ): Promise<T> =>
    resolver
      .withCredential(accountId, credentialId, (credential, admission) => {
        if (admission.provider !== provider) throw new ProviderError("INVALID_CREDENTIAL", false);
        return operation(credential);
      })
      .catch((error: unknown) => {
        if (error instanceof CredentialVaultError) throw new ProviderError("INVALID_CREDENTIAL", false);
        throw error;
      });
}
