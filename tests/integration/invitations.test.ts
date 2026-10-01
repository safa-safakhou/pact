import { randomUUID } from "node:crypto";
import { CommandDispatcher, SocialCommandHandler } from "@pact/application";
import { ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema, withTransaction } from "@pact/db";
import { IdentityError, type IdentityService } from "@pact/identity";
import {
  ActionLimitService,
  CourtInvitationDestination,
  CourtService,
  type InvitationDestinationPort,
  InvitationService,
  SocialService,
} from "@pact/kingdom";
import { ResourceLedger } from "@pact/ledger";
import { OnboardingService } from "@pact/onboarding";
import { WorldClockService } from "@pact/world";
import Fastify from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerInvitationRoutes } from "../../services/api/src/invitation-routes.js";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const productScope = ProductScopeSchema.parse("pact");
const now = new Date("2026-10-01T12:00:00Z");
const clock = { now: () => new Date(now) };
let admin: Pool;
let pool: Pool;
let schema: string;
let world: WorldClockService;
let invitations: InvitationService;
let social: SocialService;
let dispatcher: CommandDispatcher;
beforeAll(async () => {
  admin = createPool(url);
  schema = await createTestSchema(admin, "invite");
  pool = createSchemaPool(url, schema);
  world = new WorldClockService(pool, "pact");
  await world.bootstrap();
  await pool.query("UPDATE world_clocks SET next_tick_due_at = clock_timestamp() + interval '1 hour'");
  social = new SocialService("pact", new ResourceLedger("pact"), new ActionLimitService("pact"), clock);
  invitations = new InvitationService(pool, "pact", social, clock, {
    court: new CourtInvitationDestination("pact", clock, new CourtService(pool, "pact", clock)),
  });
  dispatcher = new CommandDispatcher({
    pool,
    productScope,
    clock,
    social: new SocialCommandHandler(invitations),
    game: {
      admit: (operation) => world.admitCommand((client, snapshot) => operation(client, snapshot.gameTimeMs)),
      execute: async () => {
        throw new Error("UNEXPECTED_GAME_COMMAND");
      },
    },
  });
});
afterAll(async () => {
  if (pool) await pool.end();
  if (admin && schema) await dropTestSchema(admin, schema);
  if (admin) await admin.end();
});
async function player(): Promise<{ accountId: string; kingdomId: string }> {
  const accountId = randomUUID();
  const kingdomId = randomUUID();
  await pool.query(
    "INSERT INTO accounts(id, product_scope, email, password_hash, email_verified_at, terms_version) VALUES ($1,'pact',$2,'fixture-only',$3,'terms-v1')",
    [accountId, `${accountId}@example.test`, now],
  );
  await pool.query(
    `INSERT INTO kingdoms(id, product_scope, account_id, handle, display_name, portrait, activated_at, activated_game_time_ms, activated_tick_sequence, first_tick_game_time_ms, activation_event_id)
    VALUES ($1,'pact',$2,$3,'Invitation Fixture','portrait.wolf',$4,0,0,60000,$5)`,
    [kingdomId, accountId, `invite_${randomUUID().slice(0, 8)}`, now, randomUUID()],
  );
  return { accountId, kingdomId };
}
function command(accountId: string, action: unknown, commandId = randomUUID()) {
  return dispatcher.dispatchSocial(
    { accountId, productScope, audience: "human" },
    { schemaVersion: "pact.social-command.v1", commandId, action },
  );
}
async function issue(owner: { accountId: string; kingdomId: string }, limit = 1) {
  const result = await command(owner.accountId, {
    kind: "invitation.issue",
    destinationType: "contact",
    destinationId: owner.kingdomId,
    redemptionLimit: limit,
  });
  return result.result as { invitationId: string; token: string };
}
async function preview(token: string) {
  return invitations.withRead((client) => invitations.read(client, token, 0));
}
describe("destination invitations", () => {
  it("uses game time only for future notice destinations and does not invent unsupported records", async () => {
    const issuer = await player();
    const id = randomUUID();
    const port: InvitationDestinationPort = {
      read: async (_client, destinationId) =>
        destinationId === id
          ? { type: "notice", id, title: "Notice adapter fixture", public: true, expiresGameTimeMs: 86400000 }
          : null,
      authorizeIssue: async () => {},
      accept: async () => {},
    };
    const service = new InvitationService(pool, "pact", social, clock, { notice: port });
    const link = await withTransaction(pool, (client) =>
      service.issue(client, issuer.accountId, { destinationType: "notice", destinationId: id }, 0),
    );
    const afterRealPause = new InvitationService(
      pool,
      "pact",
      social,
      { now: () => new Date("2027-10-01T12:00:00Z") },
      { notice: port },
    );
    expect(await afterRealPause.withRead((client) => afterRealPause.read(client, link.token, 0))).toMatchObject({
      status: "available",
      expiresAt: null,
      expiresGameTimeMs: 86400000,
    });
    expect(await afterRealPause.withRead((client) => afterRealPause.read(client, link.token, 86400000))).toMatchObject({
      status: "expired",
    });
    await expect(
      command(issuer.accountId, { kind: "invitation.issue", destinationType: "notice", destinationId: id }),
    ).rejects.toMatchObject({ code: "DESTINATION_UNAVAILABLE" });
    const archive = await withTransaction(pool, (client) => invitations.exportAccount(client, issuer.accountId));
    expect(JSON.stringify(archive)).not.toMatch(/token_hash|password|account_id/);
  });
  it("redeems real Court membership through HTTP without creating any other relationship", async () => {
    const issuer = await player();
    const recipient = await player();
    const courtId = randomUUID();
    await pool.query(
      "INSERT INTO courts(id, product_scope, handle, title, owner_kingdom_id, join_mode) VALUES ($1,'pact',$2,'Court destination',$3,'invitation_only')",
      [courtId, `court_${randomUUID().slice(0, 8)}`, issuer.kingdomId],
    );
    await pool.query("INSERT INTO court_memberships VALUES ($1,$2,'owner',0)", [courtId, issuer.kingdomId]);
    const response = await command(issuer.accountId, {
      kind: "invitation.issue",
      destinationType: "court",
      destinationId: courtId,
    });
    const link = response.result as { token: string; invitationId: string };
    const identity = {
      authenticate: async (token: string) => {
        if (token !== "synthetic-session") throw new IdentityError("FORBIDDEN");
        return { accountId: recipient.accountId, sessionId: "fixture-session" };
      },
      authorizeCookieWrite: async (token: string, csrf: string, origin: string) => {
        if (token !== "synthetic-session" || csrf !== "synthetic-csrf" || origin !== "https://pact.example")
          throw new IdentityError("FORBIDDEN");
        return { accountId: recipient.accountId, sessionId: "fixture-session" };
      },
    } as unknown as IdentityService;
    const server = Fastify();
    registerInvitationRoutes(server, identity, dispatcher, invitations, async () => 0);
    try {
      expect((await server.inject({ method: "GET", url: `/v1/invitations/${link.token}` })).json()).toMatchObject({
        status: "available",
        destination: { type: "court", id: courtId, public: false },
      });
      expect(
        (
          await pool.query("SELECT 1 FROM court_memberships WHERE court_id = $1 AND kingdom_id = $2", [
            courtId,
            recipient.kingdomId,
          ])
        ).rowCount,
      ).toBe(0);
      const payload = {
        schemaVersion: "pact.social-command.v1",
        commandId: randomUUID(),
        action: { kind: "invitation.accept", token: link.token },
      };
      expect((await server.inject({ method: "POST", url: "/v1/social/commands", payload })).statusCode).toBe(403);
      const headers = {
        cookie: "pact_session=synthetic-session",
        "x-csrf-token": "synthetic-csrf",
        origin: "https://pact.example",
      };
      const accepted = await server.inject({ method: "POST", url: "/v1/social/commands", headers, payload });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toMatchObject({ receipt: { code: "COMMITTED" }, result: { accepted: true, version: 2 } });
      expect(
        (
          await pool.query("SELECT role FROM court_memberships WHERE court_id = $1 AND kingdom_id = $2", [
            courtId,
            recipient.kingdomId,
          ])
        ).rows,
      ).toEqual([{ role: "member" }]);
      expect(
        (
          await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a = $1 OR kingdom_b = $1", [
            recipient.kingdomId,
          ])
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await server.inject({
            method: "POST",
            url: "/v1/social/commands",
            headers: { ...headers, origin: "https://elsewhere.example" },
            payload: { ...payload, commandId: randomUUID() },
          })
        ).statusCode,
      ).toBe(403);
      await withTransaction(pool, (client) =>
        new CourtInvitationDestination("pact", clock, new CourtService(pool, "pact", clock)).forgetAccount(
          client,
          issuer.accountId,
        ),
      );
      expect(await preview(link.token)).toMatchObject({ status: "full", destination: { available: false } });
    } finally {
      await server.close();
    }
  });
  it("enforces the three-Court limit when distinct invitations race and rolls back the losing use", async () => {
    const recipient = await player();
    const ids: string[] = [];
    const links: { token: string; invitationId: string }[] = [];
    for (let n = 0; n < 4; n++) {
      const issuer = await player();
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO courts(id, product_scope, handle, title, owner_kingdom_id, join_mode) VALUES ($1,'pact',$2,'Court fixture',$3,'open')",
        [id, `court_${randomUUID().slice(0, 8)}`, issuer.kingdomId],
      );
      await pool.query("INSERT INTO court_memberships VALUES ($1,$2,'owner',0)", [id, issuer.kingdomId]);
      if (n < 2) await pool.query("INSERT INTO court_memberships VALUES ($1,$2,'member',0)", [id, recipient.kingdomId]);
      else
        links.push(
          (
            await command(issuer.accountId, {
              kind: "invitation.issue",
              destinationType: "court",
              destinationId: id,
              redemptionLimit: 10000,
            })
          ).result as { token: string; invitationId: string },
        );
    }
    const outcomes = await Promise.allSettled(
      links.map((link) => command(recipient.accountId, { kind: "invitation.accept", token: link.token })),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason.code : null).toBe("COURT_MEMBERSHIP_LIMIT");
    expect(
      (
        await pool.query("SELECT count(*)::int AS count FROM court_memberships WHERE kingdom_id = $1", [
          recipient.kingdomId,
        ])
      ).rows[0].count,
    ).toBe(3);
    expect(
      (
        await pool.query(
          "SELECT sum(redemption_count)::int AS count FROM destination_invitations WHERE id = ANY($1::uuid[])",
          [links.map((link) => link.invitationId)],
        )
      ).rows[0].count,
    ).toBe(1);
    expect((await preview(links[0]?.token ?? "")).expiresAt).toBe(
      new Date(now.getTime() + 30 * 86400000).toISOString(),
    );
  });
  it("previews anonymously without creating a contact; accepts only through an explicit human command", async () => {
    const issuer = await player();
    const recipient = await player();
    const link = await issue(issuer);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const server = Fastify();
    registerInvitationRoutes(server, {} as IdentityService, dispatcher, invitations, async () => 0);
    try {
      const response = await server.inject({ method: "GET", url: `/v1/invitations/${link.token}` });
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json()).toMatchObject({
        status: "available",
        accepted: false,
        remainingUses: 1,
        destination: { type: "contact", id: issuer.kingdomId },
      });
      expect(JSON.stringify(response.json())).not.toMatch(/accountId|token_hash|password|balances|troops/);
      expect(
        (
          await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a = $1 OR kingdom_b = $1", [
            recipient.kingdomId,
          ])
        ).rowCount,
      ).toBe(0);
      const accepted = await command(recipient.accountId, { kind: "invitation.accept", token: link.token });
      expect(accepted.receipt.code).toBe("COMMITTED");
      expect(accepted.result).toMatchObject({ accepted: true, remainingUses: 0 });
      expect(
        (await pool.query("SELECT redemption_count FROM destination_invitations WHERE id = $1", [link.invitationId]))
          .rows[0].redemption_count,
      ).toBe(1);
      expect(
        (
          await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a = $1 OR kingdom_b = $1", [
            recipient.kingdomId,
          ])
        ).rowCount,
      ).toBe(1);
    } finally {
      await server.close();
    }
  });
  it("atomically admits only one account racing for the last use", async () => {
    const issuer = await player();
    const a = await player();
    const b = await player();
    const link = await issue(issuer);
    const outcomes = await Promise.allSettled(
      [a, b].map((p) => command(p.accountId, { kind: "invitation.accept", token: link.token })),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason.code : null).toBe("INVITATION_FULL");
    expect(
      (
        await pool.query("SELECT count(*)::int AS count FROM invitation_redemptions WHERE invitation_id = $1", [
          link.invitationId,
        ])
      ).rows[0].count,
    ).toBe(1);
    expect((await preview(link.token)).status).toBe("full");
  });
  it("retries the same receipt and never repeats a use or resurrects a removed contact", async () => {
    const issuer = await player();
    const recipient = await player();
    const link = await issue(issuer, 2);
    const id = randomUUID();
    const first = await command(recipient.accountId, { kind: "invitation.accept", token: link.token }, id);
    const repeated = await command(recipient.accountId, { kind: "invitation.accept", token: link.token }, id);
    expect(repeated.receipt).toEqual(first.receipt);
    expect(repeated.result).toBeNull();
    await withTransaction(pool, (client) => social.endContact(client, recipient.accountId, issuer.kingdomId));
    await command(issuer.accountId, { kind: "invitation.revoke", invitationId: link.invitationId });
    expect((await command(recipient.accountId, { kind: "invitation.accept", token: link.token })).result).toMatchObject(
      { accepted: true, status: "revoked", remainingUses: 1 },
    );
    expect(
      (await pool.query("SELECT 1 FROM social_contacts WHERE kingdom_a = $1 OR kingdom_b = $1", [recipient.kingdomId]))
        .rowCount,
    ).toBe(0);
    expect((await command(recipient.accountId, { kind: "invitation.accept-remembered" }, id)).receipt.code).toBe(
      "IDEMPOTENCY_CONFLICT",
    );
    await expect(
      command(issuer.accountId, { kind: "invitation.revoke", invitationId: link.invitationId }, id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("preserves the first destination across login/draft reads and rejects client replacement", async () => {
    const a = await player();
    const b = await player();
    const recipient = await player();
    // A verified account can remember before it has a gameplay kingdom.
    await pool.query("UPDATE kingdoms SET status = 'closing' WHERE id = $1", [recipient.kingdomId]);
    await pool.query("DELETE FROM kingdoms WHERE id = $1", [recipient.kingdomId]);
    const onboarding = new OnboardingService(pool, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      now: clock.now,
    });
    await onboarding.ensureDraft(recipient.accountId);
    const original = await issue(a);
    const replacement = await issue(b);
    await command(recipient.accountId, { kind: "invitation.remember", token: original.token });
    expect(
      (await command(recipient.accountId, { kind: "invitation.remember", token: replacement.token })).result,
    ).toMatchObject({ invitationId: original.invitationId });
    expect(
      (await onboarding.ensureDraft(recipient.accountId, { type: "contact", id: b.kingdomId })).invitationDestination,
    ).toEqual({ type: "contact", id: a.kingdomId });
    expect((await onboarding.getDraft(recipient.accountId)).invitationDestination).toEqual({
      type: "contact",
      id: a.kingdomId,
    });
    const saved = await invitations.withRead((client) => invitations.remembered(client, recipient.accountId, 0));
    expect(saved?.invitationId).toBe(original.invitationId);
    await expect(command(recipient.accountId, { kind: "invitation.accept-remembered" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await preview(original.token)).remainingUses).toBe(1);
  });
  it("shows distinct expired/revoked/unknown/unavailable statuses without granting anything", async () => {
    const issuer = await player();
    const recipient = await player();
    const expired = await issue(issuer);
    const revoked = await issue(issuer);
    await pool.query("UPDATE destination_invitations SET issued_at = $2, expires_at = $3 WHERE id = $1", [
      expired.invitationId,
      new Date(now.getTime() - 2 * 86400000),
      new Date(now.getTime() - 86400000),
    ]);
    expect((await preview(expired.token)).status).toBe("expired");
    await expect(
      command(recipient.accountId, { kind: "invitation.accept", token: expired.token }),
    ).rejects.toMatchObject({ code: "INVITATION_EXPIRED" });
    await command(issuer.accountId, { kind: "invitation.revoke", invitationId: revoked.invitationId });
    expect((await preview(revoked.token)).status).toBe("revoked");
    await expect(
      command(recipient.accountId, { kind: "invitation.accept", token: revoked.token }),
    ).rejects.toMatchObject({ code: "INVITATION_REVOKED" });
    expect((await preview("A".repeat(32))).status).toBe("unknown");
    const unavailable = await issue(issuer);
    await pool.query("UPDATE kingdoms SET status = 'closing' WHERE id = $1", [issuer.kingdomId]);
    expect(await preview(unavailable.token)).toMatchObject({ status: "unavailable", destination: null });
    expect(
      (await pool.query("SELECT 1 FROM invitation_redemptions WHERE account_id = $1", [recipient.accountId])).rowCount,
    ).toBe(0);
  });
  it("enforces ownership, strict inputs, product scope and human-only decisions", async () => {
    const issuer = await player();
    const outsider = await player();
    const link = await issue(issuer);
    await expect(
      command(outsider.accountId, { kind: "invitation.revoke", invitationId: link.invitationId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      command(outsider.accountId, {
        kind: "invitation.issue",
        destinationType: "contact",
        destinationId: issuer.kingdomId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      command(issuer.accountId, { kind: "invitation.accept", token: link.token, accountId: outsider.accountId }),
    ).rejects.toMatchObject({ code: "INVALID_COMMAND" });
    await expect(
      dispatcher.dispatchSocial(
        { accountId: issuer.accountId, productScope, audience: "agent", agentScopes: ["game:act"] },
        {
          schemaVersion: "pact.social-command.v1",
          commandId: randomUUID(),
          action: { kind: "invitation.accept", token: link.token },
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = new InvitationService(pool, "another-product", social, clock);
    expect((await other.withRead((client) => other.read(client, link.token, 0))).status).toBe("unknown");
    await expect(
      command(issuer.accountId, { kind: "invitation.issue", destinationType: "court", destinationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "DESTINATION_UNAVAILABLE" });
  });
  it("rolls back blocked or self acceptance, retaining all uses", async () => {
    const issuer = await player();
    const recipient = await player();
    const link = await issue(issuer);
    await expect(command(issuer.accountId, { kind: "invitation.accept", token: link.token })).rejects.toMatchObject({
      code: "SELF_CONTACT",
    });
    await pool.query(
      "INSERT INTO social_blocks(product_scope, blocker_kingdom_id, blocked_kingdom_id, created_game_time_ms) VALUES ('pact',$1,$2,0)",
      [issuer.kingdomId, recipient.kingdomId],
    );
    await expect(command(recipient.accountId, { kind: "invitation.accept", token: link.token })).rejects.toMatchObject({
      code: "BLOCKED",
    });
    expect((await preview(link.token)).remainingUses).toBe(1);
  });
  it("shares issuance quotas with legacy contact links and keeps tokens out of stored evidence", async () => {
    const issuer = await player();
    const id = randomUUID();
    const action = { kind: "invitation.issue", destinationType: "contact", destinationId: issuer.kingdomId };
    const first = await command(issuer.accountId, action, id);
    const token = (first.result as { token: string }).token;
    expect((await command(issuer.accountId, action, id)).result).toBeNull();
    const records = await pool.query("SELECT receipt FROM command_receipts WHERE command_id = $1", [id]);
    expect(JSON.stringify(records.rows)).not.toContain(token);
    expect(
      JSON.stringify(
        (await pool.query("SELECT payload FROM outbox_events WHERE payload->>'commandId' = $1", [id])).rows,
      ),
    ).not.toContain(token);
    expect(
      (
        await pool.query("SELECT octet_length(token_hash) AS bytes FROM destination_invitations WHERE id = $1", [
          (first.result as { invitationId: string }).invitationId,
        ])
      ).rows[0].bytes,
    ).toBe(32);
    for (let n = 0; n < 19; n++)
      await withTransaction(pool, (client) => social.issueDirectInvitation(client, issuer.accountId, 0));
    await expect(issue(issuer)).rejects.toMatchObject({ code: "INVITATION_LIMIT" });
    await expect(
      withTransaction(pool, (client) => social.issueDirectInvitation(client, issuer.accountId, 0)),
    ).rejects.toMatchObject({ code: "INVITATION_FULL" });
  });
  it("binds future destination effects to the same transaction; failed membership never consumes a use", async () => {
    // Port fixture, not evidence of implemented Court gameplay (PACT-056 still owns real Court records).
    await pool.query("CREATE TABLE invitation_port_fixture(account_id uuid PRIMARY KEY, destination_id uuid NOT NULL)");
    const issuer = await player();
    const recipient = await player();
    const destinationId = randomUUID();
    let reject = true;
    const port: InvitationDestinationPort = {
      read: async (_client, id) =>
        id === destinationId ? { type: "court", id, title: "Synthetic port destination", public: false } : null,
      authorizeIssue: async (_client, actor) => {
        if (actor !== issuer.kingdomId) throw new Error("FORBIDDEN");
      },
      accept: async (client, accountId, id) => {
        await client.query("INSERT INTO invitation_port_fixture VALUES ($1,$2)", [accountId, id]);
        if (reject) throw new Error("MEMBERSHIP_REJECTED");
      },
    };
    const service = new InvitationService(pool, "pact", social, clock, { court: port });
    const link = await withTransaction(pool, (client) =>
      service.issue(client, issuer.accountId, { destinationType: "court", destinationId }, 0),
    );
    await expect(
      withTransaction(pool, (client) => service.accept(client, recipient.accountId, { token: link.token }, 0)),
    ).rejects.toThrow("MEMBERSHIP_REJECTED");
    expect((await pool.query("SELECT 1 FROM invitation_port_fixture")).rowCount).toBe(0);
    reject = false;
    await withTransaction(pool, (client) => service.accept(client, recipient.accountId, { token: link.token }, 0));
    expect((await pool.query("SELECT 1 FROM invitation_port_fixture")).rowCount).toBe(1);
    expect(
      (await pool.query("SELECT redemption_count FROM destination_invitations WHERE id = $1", [link.invitationId]))
        .rows[0].redemption_count,
    ).toBe(1);
  });
  it("prunes expired links and removes account-bound destinations through the owner lifecycle hook", async () => {
    const issuer = await player();
    const recipient = await player();
    const link = await issue(issuer);
    await command(recipient.accountId, { kind: "invitation.remember", token: link.token });
    await withTransaction(pool, (client) => invitations.forgetAccount(client, issuer.accountId));
    expect((await preview(link.token)).status).toBe("unknown");
    expect(await invitations.withRead((client) => invitations.remembered(client, recipient.accountId, 0))).toBeNull();
    const old = await issue(recipient);
    await withTransaction(pool, (client) => invitations.prune(client, new Date(now.getTime() + 8 * 86400000)));
    expect((await preview(old.token)).status).toBe("unknown");
  });
});
