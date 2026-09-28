import { randomUUID } from "node:crypto";
import { pactRunCommandTool } from "@pact/application";
import { AuthorityService } from "@pact/authority";
import { type GameAction, ProductScopeSchema } from "@pact/contracts";
import { createPool, createSchemaPool, createTestSchema, dropTestSchema } from "@pact/db";
import {
  AesGcmSecretBox,
  baselineCompromisedPasswordDigests,
  IdentityService,
  LocalCompromisedPasswordChecker,
  TokenDigester,
} from "@pact/identity";
import { KingdomService, SocialOverviewReader, WorldViewService } from "@pact/kingdom";
import { MCP_PROTOCOL_PRIMARY, McpTransport } from "@pact/mcp";
import { fakeProviderModel, ProviderRouter } from "@pact/model-provider";
import { OnboardingService } from "@pact/onboarding";
import { expect, it } from "vitest";
import { type BaselineTools, playBaseline } from "../../scripts/lib/baseline-player.js";
import { AgentGuideReader } from "../../services/api/src/agent-guide.js";
import { createInferenceGameRuntime } from "../../workers/inference/src/game-runtime.js";
import { createRulesRuntime } from "../../workers/rules/src/runtime.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://pact:pact@127.0.0.1:5432/pact_test";
const productScope = ProductScopeSchema.parse("pact");
const terms = {
  aToB: { resource: "grain" as const, wholePerHour: 12 },
  bToA: { resource: "silver" as const, wholePerHour: 4 },
  aBond: null,
  bBond: null,
  durationHours: 1 as const,
  noticeHours: 0 as const,
};

async function scenario(mode: "script" | "fake-provider") {
  const admin = createPool(databaseUrl);
  const schema = await createTestSchema(admin, "baseline");
  const pool = createSchemaPool(databaseUrl, schema);
  try {
    const clock = { now: () => new Date() };
    const rules = createRulesRuntime(pool, "pact", Buffer.alloc(32, 7));
    await rules.world.bootstrap();
    await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
    const onboarding = new OnboardingService(pool, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      now: clock.now,
    });
    const kingdoms = new KingdomService(pool, {
      productScope: "pact",
      onboarding,
      world: rules.world,
      ledger: rules.ledger,
    });
    const player = async () => {
      const accountId = randomUUID();
      await pool.query(
        `INSERT INTO accounts(id,product_scope,email,password_hash,email_verified_at,terms_version)
        VALUES ($1,'pact',$2,'fixture-only',clock_timestamp(),'terms-v1')`,
        [accountId, `${accountId}@example.test`],
      );
      const draft = await onboarding.ensureDraft(accountId);
      await onboarding.updateDraft(accountId, {
        displayName: "Synthetic Baseline",
        proposedHandle: `base_${accountId.slice(0, 8)}`,
        portrait: "portrait.wolf",
        expectedVersion: draft.version,
      });
      await onboarding.recordConnectionCheck(accountId);
      const kingdom = await kingdoms.activate(accountId);
      await pool.query(
        `INSERT INTO kingdom_mandates(product_scope,account_id,allowed_actions,resource_limits)
        VALUES ('pact',$1,ARRAY['building.queue','supply.sign'],
        '{"iron":"40000","silver":"20000","grain":"7200"}'::jsonb)`,
        [accountId],
      );
      return { accountId, kingdomId: kingdom.kingdomId };
    };
    const a = await player(),
      b = await player();
    const worker = "baseline-rules-fixture";
    const lease = await rules.world.acquireLease(worker);
    if (!lease) throw new Error("Missing rules lease");
    const advance = async (minutes: number) => {
      for (let i = 0; i < minutes; i++) {
        await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()-interval '1 second'");
        expect((await rules.world.advance(worker, lease)).kind).toBe("committed");
      }
      await pool.query("UPDATE world_clocks SET next_tick_due_at=clock_timestamp()+interval '1 hour'");
    };
    // No ordinary-stock injection: normal production and eight-guard upkeep.
    await advance(60);
    let providerCalls = 0;
    const router = new ProviderRouter([
      {
        provider: "fixture",
        listModels: async () => [fakeProviderModel],
        invoke: async (request) => {
          providerCalls++;
          let action: GameAction;
          if (providerCalls === 1) action = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
          else if (providerCalls === 2)
            action = {
              kind: "game.message.send",
              recipientKingdomId: b.kingdomId,
              body: "Synthetic policy: 12 Grain/hour for 4 Silver/hour, one hour, no bonds, zero notice.",
            };
          else if (providerCalls === 3)
            action = { kind: "game.supply.offer", counterpartyKingdomId: b.kingdomId, terms };
          else {
            const result = request.messages
              .filter((m) => m.content.startsWith("Server-recorded result for tool call "))
              .map((m) => m.content)
              .join("\n");
            const offerId = /supply-offer:([0-9a-f-]{36})/.exec(result)?.[1];
            if (!offerId) throw new Error("Provider fixture did not receive the public offer receipt");
            action = { kind: "game.supply.sign", offerId, version: 1 };
          }
          return {
            stopReason: "tool_calls" as const,
            usage: { inputTokens: 20, outputTokens: 10 },
            toolCalls: [
              {
                id: `policy-${providerCalls}`,
                name: pactRunCommandTool.name,
                arguments: {
                  schemaVersion: "pact.command.v1",
                  commandId: randomUUID(),
                  action,
                  actor: {
                    principalId: a.accountId,
                    productScope,
                    audience: "agent",
                    subject: { type: "account", id: a.accountId },
                  },
                  submittedAt: clock.now().toISOString(),
                },
              },
            ],
          };
        },
      },
    ]);
    const runtime = await createInferenceGameRuntime({
      pool,
      productScope: "pact",
      clock,
      providerRouter: router,
      termsVersion: "terms-v1",
    });
    const human = (accountId: string) => ({ accountId, productScope, audience: "human" as const });
    const manual = async (accountId: string, action: GameAction) => {
      const receipt = await runtime.dispatcher.dispatch(human(accountId), {
        schemaVersion: "pact.command.v1",
        commandId: randomUUID(),
        action,
        actor: { principalId: accountId, productScope, audience: "human", subject: { type: "account", id: accountId } },
        submittedAt: clock.now().toISOString(),
      });
      expect(receipt.code).toBe("COMMITTED");
      return receipt;
    };
    const request = await manual(a.accountId, {
      kind: "game.contact.request",
      recipientKingdomId: b.kingdomId,
      note: "Baseline setup contact",
    });
    const requestId = Object.keys(request.recordVersions)[0]?.slice("contact-request:".length);
    if (!requestId) throw new Error("Missing setup contact");
    await manual(b.accountId, { kind: "game.contact.answer", requestId, accept: true });
    const views = new WorldViewService(pool, "pact");
    const identity = new IdentityService(pool, {
      productScope: "pact",
      currentTermsVersion: "terms-v1",
      allowedOrigins: new Set(["https://pact.example"]),
      clock,
      digester: new TokenDigester(Buffer.alloc(32, 19)),
      secretBox: new AesGcmSecretBox(Buffer.alloc(32, 23)),
      compromisedPasswords: new LocalCompromisedPasswordChecker(baselineCompromisedPasswordDigests),
    });
    const mcp = new McpTransport({
      pool,
      productScope: "pact",
      dispatcher: runtime.dispatcher,
      clock,
      origin: "https://pact.example",
      runLeases: runtime.runs,
      worldViews: views,
      agentGuide: new AgentGuideReader(
        views,
        new SocialOverviewReader(pool, "pact"),
        new AuthorityService(pool, { productScope: "pact", identity, now: clock.now }),
      ),
    });
    const connect = async (accountId: string) => {
      const principal = {
        accountId,
        productScope,
        audience: "agent" as const,
        agentScopes: ["world:read", "game:act"] as const,
      };
      const initialized = await mcp.handlePost(principal, {
        method: "initialize",
        id: 1,
        params: { protocolVersion: MCP_PROTOCOL_PRIMARY },
      });
      const sessionId = initialized.sessionId;
      if (!sessionId) throw new Error("Missing session");
      const calls: string[] = [];
      const tools: BaselineTools = {
        call: async (name, args) => {
          calls.push(name);
          const result = await mcp.handlePost(
            principal,
            { method: "tools/call", id: calls.length + 1, params: { name, arguments: args } },
            sessionId,
          );
          return (result.response.result as { structuredContent: unknown }).structuredContent;
        },
      };
      return { tools, calls, close: () => mcp.closeSession(principal, sessionId) };
    };
    const initial = await views.read(a.accountId, a.kingdomId, 1);
    const initialPartner = await views.read(b.accountId, b.kingdomId, 1);
    expect(initial?.audience).toBe("owner");
    if (initial?.audience !== "owner") throw new Error("Missing initial owner");
    expect(initial.balances.grain.ordinaryUnits).toBe("13200");
    expect(initial.balances.silver.ordinaryUnits).toBe("4800");
    if (initialPartner?.audience !== "owner") throw new Error("Missing partner owner fixture");
    const balances = (view: typeof initial) =>
      Object.fromEntries(
        Object.entries(view.balances).map(([resource, balance]) => [
          resource,
          {
            ordinary: balance.ordinaryUnits,
            allowance: balance.foundingAllowanceUnits,
            locked: balance.lockedUnits,
          },
        ]),
      );
    let scriptCalls = 0;
    if (mode === "script") {
      const client = await connect(a.accountId);
      try {
        const outcome = await playBaseline(client.tools);
        expect(outcome.status).toBe("awaiting_partner_signature");
        expect(outcome.committed).toHaveLength(4);
        scriptCalls = outcome.toolCalls;
        const hidden = await client.tools.call("pact_world_read_v1", { targetKingdomId: b.kingdomId });
        expect(hidden).not.toHaveProperty("balances");
      } finally {
        await client.close();
      }
    } else {
      const run = await runtime.runs.start({
        accountId: a.accountId,
        objective: "Develop Farm II and negotiate the specified one-hour exchange.",
        provider: "fixture",
        model: fakeProviderModel.id,
        limits: { maxCalls: 4 },
      });
      for (let i = 0; i < 4; i++) await runtime.runs.executeModelCall(run.runId);
      expect(providerCalls).toBe(4);
      const recorded = (await pool.query("SELECT summary FROM envoy_run_tool_results ORDER BY call_id")).rows;
      expect(recorded.map((r) => r.summary)).toEqual(
        expect.arrayContaining([expect.stringContaining('"code":"COMMITTED"')]),
      );
      for (const record of recorded) expect(record.summary).toContain('"code":"COMMITTED"');
      expect(recorded.map((r) => r.summary)).toHaveLength(4);
    }
    const partner = await connect(b.accountId);
    try {
      await partner.tools.call("run.open", {});
      const guide = (await partner.tools.call("pact_agent_guide_v1", {})) as {
        openSupplyOffers: { id: string; version: number; terms: unknown }[];
      };
      const offer = guide.openSupplyOffers[0];
      expect(offer?.terms).toEqual(terms);
      if (!offer) throw new Error("Missing public partner offer");
      await partner.tools.call("pact_game_action_v1", {
        commandId: randomUUID(),
        action: {
          kind: "game.message.send",
          recipientKingdomId: a.kingdomId,
          body: "I accept the inspected exact exchange.",
        },
      });
      await partner.tools.call("pact_game_action_v1", {
        commandId: randomUUID(),
        action: {
          kind: "game.supply.sign",
          offerId: offer.id,
          version: offer.version,
        },
      });
    } finally {
      await partner.close();
    }
    await advance(61);
    const final = await views.read(a.accountId, a.kingdomId, 1);
    const finalPartner = await views.read(b.accountId, b.kingdomId, 1);
    if (final?.audience !== "owner") throw new Error("Missing final owner");
    if (finalPartner?.audience !== "owner") throw new Error("Missing final partner owner");
    expect(final.buildings).toContainEqual({ kind: "farm", level: 2 });
    const contract = (await pool.query("SELECT status,close_reason FROM supply_contracts")).rows;
    expect(contract).toEqual([{ status: "expired", close_reason: "natural_expiry" }]);
    expect((await pool.query("SELECT count(*)::int AS count FROM supply_installments")).rows).toEqual([{ count: 120 }]);
    expect(
      (await pool.query("SELECT 1 FROM write_leases WHERE released_at IS NULL AND expires_at>clock_timestamp()"))
        .rowCount,
    ).toBe(0);
    return {
      mode,
      initial: { player: balances(initial), partner: balances(initialPartner) },
      balances: balances(final),
      partnerBalances: balances(finalPartner),
      completedContracts: contract.length,
      installments: 120,
      scriptCalls,
      providerCalls,
    };
  } finally {
    await pool.end();
    await dropTestSchema(admin, schema);
    await admin.end();
  }
}

it("compares a public-tool script with the same fake-provider policy from normally produced stocks", async () => {
  const script = await scenario("script");
  const modelRoute = await scenario("fake-provider");
  expect(script.balances).toEqual(modelRoute.balances);
  expect(script.initial).toEqual(modelRoute.initial);
  expect(script.partnerBalances).toEqual(modelRoute.partnerBalances);
  expect(script.completedContracts).toBe(modelRoute.completedContracts);
  expect(script.scriptCalls).toBe(10);
  expect(modelRoute.providerCalls).toBe(4);
  process.stdout.write(
    `Synthetic baseline comparison (not live model performance): ${JSON.stringify({ script, modelRoute })}\n`,
  );
}, 60000);
