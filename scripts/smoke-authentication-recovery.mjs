// Run through pact-entrypoint inside the deployed API container. Only synthetic owner fixtures.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createPool } from "@pact/db";
import { AesGcmSecretBox } from "@pact/identity";

const origin = process.env.PACT_ORIGIN;
assert(origin && process.env.DATABASE_URL && process.env.IDENTITY_ENCRYPTION_KEY && process.env.IDENTITY_TOKEN_PEPPER);
const pool = createPool(process.env.DATABASE_URL);
const box = new AesGcmSecretBox(Buffer.from(process.env.IDENTITY_ENCRYPTION_KEY, "base64url"));
let cookie = "",
  accountId = "";
async function call(path, { method = "GET", body, session = cookie, csrf } = {}) {
  const r = await fetch(new URL(path, origin), {
    method,
    headers: {
      "user-agent": "PACT synthetic authentication acceptance",
      ...(session ? { cookie: session } : {}),
      ...(body ? { "content-type": "application/json", origin } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  return { status: r.status, data: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const entryKey = randomUUID();
  const join = await call("/v1/play/join", {
    method: "POST",
    body: { entryKey, nickname: "Recovery Release Fixture" },
  });
  assert.equal(join.status, 200);
  cookie = join.cookie;
  accountId = join.data.accountId;
  assert(cookie && accountId);
  const kingdomId = join.data.kingdomId;
  const boot = await call("/v1/auth/session");
  assert.equal(boot.status, 200);
  const repeat = await call("/v1/auth/session");
  assert.equal(boot.data.csrfToken, repeat.data.csrfToken);
  const restore = await call("/v1/play/join", { method: "POST", body: { entryKey, existingOnly: true }, session: "" });
  assert.equal(restore.status, 200);
  assert.equal(restore.data.kingdomId, kingdomId);
  const email = `pact-recovery-${randomUUID()}@example.invalid`,
    password = randomBytes(30).toString("base64url");
  const legal = await call("/v1/legal/notices");
  assert.equal(legal.status, 200);
  const saved = await call("/v1/auth/guest/save", {
    method: "POST",
    csrf: boot.data.csrfToken,
    body: { email, password, age18Declared: true, acceptedTermsVersion: legal.data.documents.termsVersion },
  });
  assert.equal(saved.status, 200);
  const outbox = (
    await pool.query(
      "SELECT payload FROM outbox_events WHERE type='security.email.requested.v1' AND payload->>'accountId'=$1 ORDER BY id DESC LIMIT 1",
      [accountId],
    )
  ).rows[0];
  assert(outbox?.payload?.sealedToken);
  const token = Buffer.from(box.open(outbox.payload.sealedToken)).toString("utf8");
  let captured = false;
  for (let i = 0; i < 10; i++) {
    const messages = await fetch("http://mailpit:8025/api/v1/messages").then((r) => r.json());
    if (messages.messages?.some((m) => m.To?.some((to) => to.Address === email))) {
      captured = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert(captured, "Synthetic verification email was not observed in captured SMTP");
  const verified = await call("/v1/auth/verify", { method: "POST", body: { token } });
  assert.equal(verified.status, 200);
  assert.equal((await call("/v1/auth/verify", { method: "POST", body: { token } })).status, 400);
  const old = await call("/v1/play/join", { method: "POST", body: { entryKey, existingOnly: true }, session: "" });
  assert.equal(old.status, 403);
  const login = await call("/v1/auth/login", { method: "POST", body: { email, password }, session: "" });
  assert.equal(login.status, 200);
  const second = await call("/v1/auth/session", { session: login.cookie });
  assert.equal(second.data.accountId, accountId);
  assert.equal(second.data.guest, false);
  assert.equal((await call("/v1/kingdom/me", { session: login.cookie })).data.kingdomId, kingdomId);
  const logout = await call("/v1/auth/logout", {
    method: "POST",
    body: {},
    session: login.cookie,
    csrf: second.data.csrfToken,
  });
  assert.equal(logout.status, 200);
  assert.equal((await call("/v1/auth/session", { session: login.cookie })).status, 403);
  assert.equal((await call("/v1/auth/session")).status, 200);
  console.log(
    JSON.stringify({
      observedAt: new Date().toISOString(),
      accountId,
      kingdomId,
      sameOwner: true,
      guestRecovery: true,
      stableTabCsrf: true,
      verifiedConversion: true,
      replayDenied: true,
      oldRecoveryDenied: true,
      secondDeviceLogin: true,
      sessionOnlyLogout: true,
      capturedEmail: true,
      emailDelivery: legal.data.emailDelivery,
      modelCalls: 0,
      gameCommands: 0,
    }),
  );
} finally {
  if (accountId) {
    await pool.query("UPDATE sessions SET revoked_at=clock_timestamp() WHERE account_id=$1 AND revoked_at IS NULL", [
      accountId,
    ]);
    await pool.query(
      "UPDATE oauth_grants SET revoked_at=clock_timestamp() WHERE account_id=$1 AND revoked_at IS NULL",
      [accountId],
    );
  }
  await pool.end();
}
