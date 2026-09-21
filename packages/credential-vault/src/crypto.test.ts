import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential, RsaOaepPrivateKeyUnwrapper, RsaOaepPublicKeyWrapper } from "./index.js";

const keys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const context = {
  productScope: "pact",
  accountId: "11111111-1111-4111-8111-111111111111",
  credentialId: "22222222-2222-4222-8222-222222222222",
  provider: "openai" as const,
  version: 1,
};

describe("credential envelope encryption", () => {
  it("keeps the API wrapper one-way and binds ciphertext to its owner context", async () => {
    const wrapper = new RsaOaepPublicKeyWrapper(keys.publicKey, "fixture-v1");
    const unwrapper = new RsaOaepPrivateKeyUnwrapper(keys.privateKey, new Set(["fixture-v1"]));
    expect("unwrapKey" in wrapper).toBe(false);

    const encrypted = await encryptCredential(Buffer.from("provider-secret"), context, wrapper, (size) =>
      Buffer.alloc(size, size),
    );
    await expect(decryptCredential(encrypted, context, unwrapper)).resolves.toEqual(Buffer.from("provider-secret"));
    await expect(
      decryptCredential(encrypted, { ...context, accountId: "33333333-3333-4333-8333-333333333333" }, unwrapper),
    ).rejects.toMatchObject({ code: "DECRYPTION_FAILED" });
  });
});
