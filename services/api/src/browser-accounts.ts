import { IdentityError, type IdentityService } from "@pact/identity";
import type { KingdomService } from "@pact/kingdom";
import type { FastifyReply, FastifyRequest } from "fastify";

const prefix = "__Host-pact_saved_";
const accountPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function browserCookies(request: FastifyRequest): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    try {
      if (!result.has(key)) result.set(key, decodeURIComponent(part.slice(at + 1)));
    } catch {
      /* Invalid cookies do not grant access. */
    }
  }
  return result;
}
export function savedAccountToken(request: FastifyRequest, accountId: string): string {
  if (!accountPattern.test(accountId)) throw new IdentityError("FORBIDDEN");
  const token = browserCookies(request).get(prefix + accountId);
  if (!token) throw new IdentityError("FORBIDDEN");
  return token;
}
function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}
export function forgetBrowserAccount(reply: FastifyReply, accountId: string, active = false) {
  reply.header("set-cookie", [cookie(prefix + accountId, "", 0), ...(active ? [cookie("pact_session", "", 0)] : [])]);
}
export function pruneBrowserAccounts(request: FastifyRequest, reply: FastifyReply, validIds: string[]) {
  const valid = new Set(validIds);
  const removed = [...browserCookies(request).keys()].filter(
    (k) => k.startsWith(prefix) && accountPattern.test(k.slice(prefix.length)) && !valid.has(k.slice(prefix.length)),
  );
  if (!removed.length) return;
  const existing = reply.getHeader("set-cookie");
  reply.header("set-cookie", [
    ...(Array.isArray(existing) ? existing : existing ? [String(existing)] : []),
    ...removed.map((k) => cookie(k, "", 0)),
  ]);
}
export function rememberBrowserAccount(
  request: FastifyRequest,
  reply: FastifyReply,
  session: { accountId: string; sessionToken: string; absoluteExpiresAt: Date },
  activate = true,
) {
  const maxAge = Math.max(0, Math.floor((session.absoluteExpiresAt.getTime() - Date.now()) / 1000));
  const saved = [...browserCookies(request).keys()].filter(
    (k) => k.startsWith(prefix) && accountPattern.test(k.slice(prefix.length)) && k !== prefix + session.accountId,
  );
  reply.header("set-cookie", [
    ...(activate ? [cookie("pact_session", session.sessionToken, maxAge)] : []),
    cookie(prefix + session.accountId, session.sessionToken, maxAge),
    ...saved.slice(0, Math.max(0, saved.length - 9)).map((k) => cookie(k, "", 0)),
  ]);
  reply.header("cache-control", "no-store");
}
export async function browserAccountList(request: FastifyRequest, identity: IdentityService, kingdom?: KingdomService) {
  const cookies = browserCookies(request);
  const currentToken = cookies.get("pact_session");
  const current = currentToken ? await identity.authenticate(currentToken, false).catch(() => null) : null;
  const candidates = new Map<string, string>();
  if (current && currentToken) candidates.set(current.accountId, currentToken);
  for (const [key, token] of cookies) {
    if (key.startsWith(prefix) && accountPattern.test(key.slice(prefix.length)) && candidates.size < 10)
      if (!candidates.has(key.slice(prefix.length))) candidates.set(key.slice(prefix.length), token);
  }
  const accounts = [];
  for (const [accountId, token] of candidates) {
    let session: Awaited<ReturnType<IdentityService["authenticate"]>>;
    try {
      session = await identity.authenticate(token, false);
    } catch (error) {
      if (error instanceof IdentityError) continue;
      throw error;
    }
    if (session.accountId !== accountId || !(await identity.browserAccountActive(accountId))) continue;
    const profile = await kingdom?.accountDisplay(accountId);
    accounts.push({
      accountId,
      displayName: profile?.displayName ?? "PACT account",
      handle: profile?.handle ?? null,
      guest: await identity.isGuest(accountId),
      current: current?.accountId === accountId,
      csrfToken: identity.browserSessionCsrf(token),
      expiresAt: session.absoluteExpiresAt.toISOString(),
    });
  }
  return { accounts, currentAccountId: accounts.find((account) => account.current)?.accountId ?? null };
}
