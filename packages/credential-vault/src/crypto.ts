import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
  privateDecrypt,
  publicEncrypt,
} from "node:crypto";
import type { CredentialKeyUnwrapper, CredentialKeyWrapper, CredentialWrapContext, WrappedDataKey } from "./types.js";
import { CredentialVaultError } from "./types.js";

export interface EncryptedCredential {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly authTag: Uint8Array;
  readonly wrappedDataKey: WrappedDataKey;
}

function additionalData(context: CredentialWrapContext): Uint8Array {
  return Buffer.from(
    JSON.stringify({
      productScope: context.productScope,
      accountId: context.accountId,
      credentialId: context.credentialId,
      provider: context.provider,
      version: context.version,
    }),
    "utf8",
  );
}

export class RsaOaepPublicKeyWrapper implements CredentialKeyWrapper {
  readonly #key: KeyObject;

  constructor(
    publicKey: string | Uint8Array,
    private readonly keyId: string,
  ) {
    this.#key = createPublicKey(typeof publicKey === "string" ? publicKey : Buffer.from(publicKey));
    if (!keyId.trim()) throw new Error("Wrapping key id is required");
  }

  async wrapKey(dataKey: Uint8Array, _context: CredentialWrapContext): Promise<WrappedDataKey> {
    return {
      algorithm: "RSA-OAEP-256",
      keyId: this.keyId,
      wrappedKey: publicEncrypt(
        { key: this.#key, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING },
        dataKey,
      ).toString("base64url"),
    };
  }
}

export class RsaOaepPrivateKeyUnwrapper implements CredentialKeyUnwrapper {
  readonly #key: KeyObject;

  constructor(
    privateKey: string | Uint8Array,
    private readonly acceptedKeyIds: ReadonlySet<string>,
  ) {
    this.#key = createPrivateKey(typeof privateKey === "string" ? privateKey : Buffer.from(privateKey));
    if (acceptedKeyIds.size === 0) throw new Error("At least one wrapping key id is required");
  }

  async unwrapKey(wrapped: WrappedDataKey, _context: CredentialWrapContext): Promise<Uint8Array> {
    if (wrapped.algorithm !== "RSA-OAEP-256" || !this.acceptedKeyIds.has(wrapped.keyId)) {
      throw new CredentialVaultError("DECRYPTION_FAILED");
    }
    try {
      return privateDecrypt(
        { key: this.#key, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING },
        Buffer.from(wrapped.wrappedKey, "base64url"),
      );
    } catch {
      throw new CredentialVaultError("DECRYPTION_FAILED");
    }
  }
}

export async function encryptCredential(
  plaintext: Uint8Array,
  context: CredentialWrapContext,
  wrapper: CredentialKeyWrapper,
  randomBytes: (size: number) => Uint8Array,
): Promise<EncryptedCredential> {
  const dataKey = Buffer.from(randomBytes(32));
  const nonce = Buffer.from(randomBytes(12));
  if (dataKey.byteLength !== 32 || nonce.byteLength !== 12) throw new Error("Credential randomness source failed");
  try {
    const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
    cipher.setAAD(additionalData(context));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const wrappedDataKey = await wrapper.wrapKey(dataKey, context);
    return { ciphertext, nonce, authTag: cipher.getAuthTag(), wrappedDataKey };
  } finally {
    dataKey.fill(0);
  }
}

export async function decryptCredential(
  encrypted: EncryptedCredential,
  context: CredentialWrapContext,
  unwrapper: CredentialKeyUnwrapper,
): Promise<Uint8Array> {
  let dataKey: Buffer | undefined;
  try {
    dataKey = Buffer.from(await unwrapper.unwrapKey(encrypted.wrappedDataKey, context));
    if (dataKey.byteLength !== 32) throw new CredentialVaultError("DECRYPTION_FAILED");
    const decipher = createDecipheriv("aes-256-gcm", dataKey, encrypted.nonce);
    decipher.setAAD(additionalData(context));
    decipher.setAuthTag(Buffer.from(encrypted.authTag));
    return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]);
  } catch (error) {
    if (error instanceof CredentialVaultError) throw error;
    throw new CredentialVaultError("DECRYPTION_FAILED");
  } finally {
    dataKey?.fill(0);
  }
}
