import { CredentialResolver, RsaOaepPrivateKeyUnwrapper } from "@pact/credential-vault";
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
