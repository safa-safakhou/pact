import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, selectExcerpt, sha256, signPayload, verifyPayload } from "./index.js";

describe("exact source evidence", () => {
  it("canonicalizes recursive keys in UTF-16 order, preserving arrays/accepted Unicode", () => {
    expect(canonicalJson({ z: [3, { b: "é", a: "e\u0301" }], "\ue000": 1, "😀": 2, a: 0 })).toBe(
      '{"a":0,"z":[3,{"a":"é","b":"é"}],"😀":2,"":1}',
    );
    for (const value of [
      NaN,
      Infinity,
      0.1,
      Number.MAX_SAFE_INTEGER + 1,
      undefined,
      new Date(),
      "\ud800",
      "\udc00",
      { a: undefined },
    ])
      expect(() => canonicalJson(value)).toThrow();
    expect(canonicalJson(-0)).toBe("0");
  });
  it("selects exact UTF-8 bytes with every leading, middle and trailing omission", () => {
    const original = "a😀bcéZ",
      result = selectExcerpt(original, [
        { start: 1, end: 5 },
        { start: 6, end: 7 },
      ]);
    expect(result.segments).toEqual([
      { kind: "omitted", start: 0, end: 1 },
      { kind: "excerpt", start: 1, end: 5, text: "😀" },
      { kind: "omitted", start: 5, end: 6 },
      { kind: "excerpt", start: 6, end: 7, text: "c" },
      { kind: "omitted", start: 7, end: 10 },
    ]);
    expect(result.content_digest).toBe(sha256(Buffer.from(original)));
    expect(result.context).toContain("context omitted");
    expect(selectExcerpt(original, [{ start: 0, end: 10 }]).context).toContain("Complete source excerpt");
    for (const ranges of [
      [],
      [{ start: 2, end: 5 }],
      [{ start: 0, end: 3 }],
      [
        { start: 1, end: 5 },
        { start: 0, end: 1 },
      ],
      [
        { start: 0, end: 5 },
        { start: 1, end: 5 },
      ],
      [{ start: 0, end: 11 }],
      [{ start: 0, end: 0 }],
    ])
      expect(() => selectExcerpt(original, ranges)).toThrow("INVALID_RANGES");
    expect(() => selectExcerpt("\ud800", [{ start: 0, end: 3 }])).toThrow("INVALID_UNICODE");
  });
  it("matches RFC 8032 Ed25519 test 1 and verifies domain-bound canonical payloads", () => {
    const seed = Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex"),
      pub = Buffer.from("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "hex");
    const key = createPrivateKey({
      key: { kty: "OKP", crv: "Ed25519", x: pub.toString("base64url"), d: seed.toString("base64url") },
      format: "jwk",
    });
    expect(sign(null, Buffer.alloc(0), key).toString("hex")).toBe(
      "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    );
    const { privateKey, publicKey } = generateKeyPairSync("ed25519"),
      payload = { z: "Text", a: 1 },
      signature = signPayload("TEST\n", payload, privateKey),
      jwk = publicKey.export({ format: "jwk" });
    expect(verifyPayload("TEST\n", { a: 1, z: "Text" }, signature, jwk)).toBe(true);
    expect(verifyPayload("OTHER\n", payload, signature, jwk)).toBe(false);
    expect(verifyPayload("TEST\n", { a: 1, z: "Changed" }, signature, jwk)).toBe(false);
    expect(verifyPayload("TEST\n", payload, `${signature}=`, jwk)).toBe(false);
    expect(verifyPayload("TEST\n", payload, signature, privateKey.export({ format: "jwk" }))).toBe(false);
  });
});
