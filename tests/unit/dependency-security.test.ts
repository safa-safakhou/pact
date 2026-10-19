import { generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url),
  braces = require("braces"),
  forge = require("node-forge");
it.each(["parse", "compile", "expand", "stringify"])(
  "rejects excessive brace/parenthesis nesting through %s before recursive walking",
  (method) => {
    for (const [open, close] of [
      ["{", "}"],
      ["(", ")"],
    ] as const) {
      const pattern = open.repeat(4000) + "a,b" + close.repeat(4000);
      expect(() => braces[method](pattern)).toThrow(/nesting.*maximum depth/i);
    }
  },
);
it.each(["compile", "expand", "stringify"])("guards externally supplied deep and cyclic ASTs in %s", (method) => {
  let ast = { type: "text", value: "x" } as Record<string, unknown>;
  for (let i = 0; i < 5000; i++) ast = { type: "root", nodes: [ast] };
  expect(() => braces[method](ast)).toThrow(/nesting.*maximum depth/i);
  const cyclic: { type: string; nodes: unknown[] } = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  expect(() => braces[method](cyclic)).toThrow(/cyclic/i);
});
it("preserves ordinary expansion, escaping and micromatch behavior", () => {
  expect(braces.expand("src/{api,web}/{a,b}.ts")).toEqual([
    "src/api/a.ts",
    "src/api/b.ts",
    "src/web/a.ts",
    "src/web/b.ts",
  ]);
  expect(braces.expand("{01..03}")).toEqual(["01", "02", "03"]);
  expect(braces.stringify(braces.parse("a/{b,c}/d"))).toBe("a/{b,c}/d");
  expect(require("micromatch")(["src/a.ts", "src/a.js", "tests/b.ts"], "{src,tests}/**/*.ts")).toEqual([
    "src/a.ts",
    "tests/b.ts",
  ]);
});
const { privateKey: privatePem, publicKey: publicPem } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 3,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const privateKey = forge.pki.privateKeyFromPem(privatePem),
  publicKey = forge.pki.publicKeyFromPem(publicPem);
function digestInfo(extra: boolean, parameters = true) {
  const a = forge.asn1,
    c = a.Class.UNIVERSAL,
    t = a.Type,
    md = forge.md.sha256.create().update("synthetic security regression");
  const algorithm = [a.create(c, t.OID, false, a.oidToDer(forge.oids.sha256).getBytes())];
  if (parameters) algorithm.push(a.create(c, t.NULL, false, ""));
  if (extra) algorithm.push(a.create(c, t.OCTETSTRING, false, "unconsumed garbage"));
  const value = a.create(c, t.SEQUENCE, true, [
    a.create(c, t.SEQUENCE, true, algorithm),
    a.create(c, t.OCTETSTRING, false, md.digest().getBytes()),
  ]);
  return { digest: md.digest().getBytes(), signature: privateKey.sign(a.toDer(value).getBytes(), "NONE") };
}
it.each([true, false])("rejects extra nested DigestAlgorithm elements with NULL parameters=%s", (parameters) => {
  const value = digestInfo(true, parameters);
  expect(() => publicKey.verify(value.digest, value.signature)).toThrow(/valid RSASSA-PKCS1-v1_5 DigestInfo/);
});
it.each([true, false])("accepts the correct SHA256 AlgorithmIdentifier with NULL parameters=%s", (parameters) => {
  const value = digestInfo(false, parameters);
  expect(publicKey.verify(value.digest, value.signature)).toBe(true);
  expect(publicKey.verify(forge.md.sha256.create().update("other").digest().getBytes(), value.signature)).toBe(false);
});
it("preserves Xcode CommonJS UUID generation and rejects short v3/v5 output buffers", () => {
  const uuid = require("uuid"),
    xcode = require("xcode"),
    project = xcode.project("synthetic.pbxproj");
  project.hash = { project: { objects: {} } };
  expect(project.generateUuid()).toMatch(/^[A-F0-9]{24}$/);
  for (const v of [uuid.v3, uuid.v5]) expect(() => v("test", uuid.v4(), new Uint8Array(8), 4)).toThrow(RangeError);
});

it("all transitive consumers resolve the patched copies, not merely root test dependencies", () => {
  const fromMicro = createRequire(require.resolve("micromatch")),
    fromExpo = createRequire(require.resolve("@expo/cli/package.json")),
    fromCertificates = createRequire(require.resolve("@expo/code-signing-certificates")),
    fromXcode = createRequire(require.resolve("xcode"));
  expect(fromMicro("braces")).toBe(braces);
  expect(fromExpo("node-forge")).toBe(forge);
  expect(fromCertificates("node-forge")).toBe(forge);
  expect(fromXcode("uuid/package.json").version).toBe("11.1.1");
});
it("retains Expo self-signed certificate, CSR and signed update-buffer verification", () => {
  const api = require("@expo/code-signing-certificates"),
    keys = { publicKey, privateKey };
  const certificate = api.generateSelfSignedCodeSigningCertificate({
    keyPair: keys,
    commonName: "synthetic.example.test",
    validityNotBefore: new Date(Date.now() - 60000),
    validityNotAfter: new Date(Date.now() + 60000),
  });
  expect(() => api.validateSelfSignedCertificate(certificate, keys)).not.toThrow();
  const buffer = Buffer.from("synthetic update contents"),
    signature = api.signBufferRSASHA256AndVerify(privateKey, certificate, buffer);
  expect(
    publicKey.verify(
      forge.md.sha256.create().update(buffer.toString("binary")).digest().getBytes(),
      forge.util.decode64(signature),
    ),
  ).toBe(true);
  expect(api.generateCSR(keys, "synthetic.example.test").verify()).toBe(true);
});
it("allows normal nested input and escaped/quoted literal braces", () => {
  expect(braces.expand("{a,{b,c}}")).toEqual(["a", "b", "c"]);
  expect(() => braces.compile("{".repeat(100) + "x" + "}".repeat(100))).not.toThrow();
  expect(braces.expand('"' + "{".repeat(200) + '"')).toEqual(["{".repeat(200)]);
});
