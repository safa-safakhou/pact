import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const OAUTH_SCOPES = ["world:read", "messages:write", "game:act"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const HUMAN_ONLY_OPERATIONS = [
  "approval.commit",
  "credential.read",
  "authority.raise",
  "checkout",
  "account.delete",
  "account.export",
] as const;

export class OAuthError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "INVALID_CLIENT"
      | "INVALID_GRANT"
      | "INVALID_SCOPE"
      | "UNAUTHORIZED_CLIENT"
      | "ACCESS_DENIED"
      | "FORBIDDEN"
      | "SSRF_BLOCKED",
  ) {
    super(code);
    this.name = "OAuthError";
  }
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function issueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const digest = createHash("sha256").update(verifier, "utf8").digest("base64url");
  const left = Buffer.from(digest);
  const right = Buffer.from(challenge);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parseScopes(input: string | string[] | undefined): OAuthScope[] {
  const parts = Array.isArray(input) ? input : (input ?? "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new OAuthError("INVALID_SCOPE");
  const scopes: OAuthScope[] = [];
  for (const part of parts) {
    if (!OAUTH_SCOPES.includes(part as OAuthScope)) throw new OAuthError("INVALID_SCOPE");
    if (!scopes.includes(part as OAuthScope)) scopes.push(part as OAuthScope);
  }
  return scopes;
}

export function assertExactRedirect(registered: readonly string[], redirectUri: string): void {
  if (!registered.includes(redirectUri)) throw new OAuthError("INVALID_REQUEST");
}

function isPrivateOrLocalIp(address: string): boolean {
  if (address === "::1" || address === "127.0.0.1") return true;
  if (address.startsWith("10.") || address.startsWith("192.168.") || address.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80")) return true;
  return false;
}

export async function assertSafeMetadataUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new OAuthError("SSRF_BLOCKED");
  }
  if (url.protocol !== "https:") throw new OAuthError("SSRF_BLOCKED");
  if (url.username || url.password) throw new OAuthError("SSRF_BLOCKED");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new OAuthError("SSRF_BLOCKED");
  }
  if (isIP(host) && isPrivateOrLocalIp(host)) throw new OAuthError("SSRF_BLOCKED");
  if (!isIP(host)) {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => isPrivateOrLocalIp(record.address))) {
      throw new OAuthError("SSRF_BLOCKED");
    }
  }
  return url;
}

export type MetadataFetch = (url: URL, redirectCount: number) => Promise<Response>;

export async function fetchClientMetadata(
  urlString: string,
  fetchImpl: MetadataFetch = defaultMetadataFetch,
): Promise<{ client_name: string; redirect_uris: string[] }> {
  const url = await assertSafeMetadataUrl(urlString);
  const response = await fetchImpl(url, 0);
  if (!response.ok) throw new OAuthError("INVALID_CLIENT");
  const text = await response.text();
  if (text.length > 64_000) throw new OAuthError("SSRF_BLOCKED");
  let body: { client_name?: unknown; redirect_uris?: unknown };
  try {
    body = JSON.parse(text) as { client_name?: unknown; redirect_uris?: unknown };
  } catch {
    throw new OAuthError("INVALID_CLIENT");
  }
  if (typeof body.client_name !== "string" || !Array.isArray(body.redirect_uris)) {
    throw new OAuthError("INVALID_CLIENT");
  }
  const redirectUris = body.redirect_uris.filter((value): value is string => typeof value === "string");
  if (redirectUris.length === 0) throw new OAuthError("INVALID_CLIENT");
  return { client_name: body.client_name, redirect_uris: redirectUris };
}

async function defaultMetadataFetch(url: URL, redirectCount: number): Promise<Response> {
  if (redirectCount > 3) throw new OAuthError("SSRF_BLOCKED");
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new OAuthError("SSRF_BLOCKED");
    const next = new URL(location, url);
    await assertSafeMetadataUrl(next.toString());
    return defaultMetadataFetch(next, redirectCount + 1);
  }
  return response;
}

export function tokenAllowsHumanOnly(_scopes: readonly string[], operation: string): boolean {
  return !(HUMAN_ONLY_OPERATIONS as readonly string[]).includes(operation);
}
