import { createHash, createPublicKey, type JsonWebKey, type KeyObject, sign, verify } from "node:crypto";

export function validUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}
/** RFC 8785 JSON subset: only safe integer numbers; no normalization or toJSON hooks. */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    if (!validUnicode(value)) throw new Error("INVALID_UNICODE");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("UNSAFE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJson).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const object = value as Record<string, unknown>;
    if (Object.getOwnPropertySymbols(object).length) throw new Error("INVALID_JSON");
    return `{${Object.keys(object)
      .sort()
      .map((k) => `${canonicalJson(k)}:${canonicalJson(object[k])}`)
      .join(",")}}`;
  }
  throw new Error("INVALID_JSON");
}
export const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
export type ByteRange = { start: number; end: number };
/** Byte offsets, exact accepted Unicode, and explicit every-gap omission markers. */
export function selectExcerpt(original: string, ranges: readonly ByteRange[]) {
  if (!validUnicode(original)) throw new Error("INVALID_UNICODE");
  const bytes = Buffer.from(original, "utf8"),
    boundaries = new Set([0]);
  let position = 0;
  for (const point of original) {
    position += Buffer.byteLength(point, "utf8");
    boundaries.add(position);
  }
  if (ranges.length === 0 || ranges.length > 20) throw new Error("INVALID_RANGES");
  const segments: (
    | { kind: "omitted"; start: number; end: number }
    | { kind: "excerpt"; start: number; end: number; text: string }
  )[] = [];
  let previous = 0;
  for (const { start, end } of ranges) {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < previous ||
      end <= start ||
      !boundaries.has(start) ||
      !boundaries.has(end)
    )
      throw new Error("INVALID_RANGES");
    if (start > previous) segments.push({ kind: "omitted", start: previous, end: start });
    segments.push({ kind: "excerpt", start, end, text: bytes.subarray(start, end).toString("utf8") });
    previous = end;
  }
  if (previous < bytes.length) segments.push({ kind: "omitted", start: previous, end: bytes.length });
  return {
    content_digest: sha256(bytes),
    excerpt_ranges: ranges.map((r) => ({ ...r })),
    segments,
    context: segments.some((s) => s.kind === "omitted")
      ? "Selected excerpts; context omitted"
      : "Complete source excerpt; not a complete account",
  };
}
export function signPayload(domain: string, payload: unknown, key: KeyObject): string {
  if (key.asymmetricKeyType !== "ed25519") throw new Error("INVALID_KEY");
  return sign(null, Buffer.from(domain + canonicalJson(payload), "utf8"), key).toString("base64url");
}
export function verifyPayload(domain: string, payload: unknown, signature: string, jwk: JsonWebKey): boolean {
  try {
    if (!/^[A-Za-z0-9_-]{86}$/.test(signature) || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || jwk.d !== undefined)
      return false;
    const bytes = Buffer.from(signature, "base64url");
    if (bytes.length !== 64 || bytes.toString("base64url") !== signature) return false;
    return verify(
      null,
      Buffer.from(domain + canonicalJson(payload), "utf8"),
      createPublicKey({ key: jwk, format: "jwk" }),
      bytes,
    );
  } catch {
    return false;
  }
}
