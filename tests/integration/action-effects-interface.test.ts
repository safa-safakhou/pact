import { AgentOperationService } from "@pact/application";
import { pactActionEffectsExecuteTool, pactActionEffectsQuoteTool } from "@pact/contracts";
import Fastify from "fastify";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  actionEffectsAuthenticator,
  registerActionEffectsRoutes,
} from "../../services/api/src/action-effects-routes.js";
import { buildServer } from "../../services/api/src/server.js";
import { actionEffectsFixture } from "../fixtures/action-effects.js";

let f: Awaited<ReturnType<typeof actionEffectsFixture>>;
beforeAll(async () => {
  f = await actionEffectsFixture();
});
afterAll(async () => {
  await f?.close();
});
it("declares read/write tools accurately and shares normal API/MCP guard semantics", async () => {
  const a = await f.owner(),
    cmd = f.command(a.principal, { kind: "game.training.queue", type: "spearman", count: 1 });
  const operations = new AgentOperationService({
    productScope: "pact",
    dispatcher: f.dispatcher,
    actionEffects: f.effects,
  } as ConstructorParameters<typeof AgentOperationService>[0]);
  const app = Fastify();
  registerActionEffectsRoutes(app, async () => a.principal, f.effects, f.dispatcher);
  const api = await app.inject({ method: "POST", url: "/v1/agent-action-effects/quote", payload: { command: cmd } });
  expect(api.statusCode).toBe(200);
  const mcp = await operations.execute(
    a.principal,
    { name: pactActionEffectsQuoteTool.name, arguments: { command: cmd } },
    a.principal.sessionId!,
  );
  expect(mcp.structuredContent).toEqual(api.json());
  const q = api.json(),
    g = {
      command: cmd,
      guard: { schemaVersion: "fleet.action-effects-guard.v1", expectedRevision: q.revision, expectedEffects: q },
    };
  const executed = await app.inject({ method: "POST", url: "/v1/agent-action-effects/execute", payload: g });
  expect(executed.json().code).toBe("COMMITTED");
  const repeated = await operations.execute(
    a.principal,
    { name: pactActionEffectsExecuteTool.name, arguments: g },
    a.principal.sessionId!,
  );
  expect(repeated.structuredContent).toMatchObject({ code: "COMMITTED", commandId: cmd.commandId });
  expect(pactActionEffectsQuoteTool.annotations.readOnlyHint).toBe(true);
  expect(pactActionEffectsExecuteTool.annotations.readOnlyHint).toBe(false);
  expect(
    operations.listOperations(a.principal).find((t) => t.name === pactActionEffectsExecuteTool.name)?._meta[
      "pact/operation"
    ].readOnly,
  ).toBe(false);
  await app.close();
});
it("omits disabled tools and denies missing scoped authority", async () => {
  const a = await f.owner(),
    operations = new AgentOperationService({ productScope: "pact", dispatcher: f.dispatcher } as ConstructorParameters<
      typeof AgentOperationService
    >[0]);
  expect(operations.listOperations(a.principal).some((t) => t.name === pactActionEffectsQuoteTool.name)).toBe(false);
  await expect(
    operations.execute(
      { ...a.principal, agentScopes: ["world:read"] },
      { name: pactActionEffectsExecuteTool.name, arguments: {} },
      a.principal.sessionId!,
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("keeps default routes and advertisement off and derives API identity from scoped credentials", async () => {
  const disabled = buildServer(f.pool, false);
  expect(
    (await disabled.inject({ method: "POST", url: "/v1/agent-action-effects/quote", payload: {} })).statusCode,
  ).toBe(404);
  expect((await disabled.inject({ method: "GET", url: "/v2/interfaces" })).json().actionEffects).toEqual({
    enabled: false,
    schemaVersion: null,
    actions: [],
  });
  await disabled.close();
  const a = await f.owner(),
    cmd = f.command(a.principal, { kind: "game.training.queue", type: "spearman", count: 1 }),
    g = await f.guarded(a.principal, cmd),
    app = Fastify();
  const identity = {
      authenticate: async () => {
        throw Error("NO_COOKIE");
      },
    },
    oauth = {
      introspectAccessToken: async (token: string) =>
        token === "valid"
          ? { accountId: a.accountId, audience: "mcp", scopes: ["world:read", "game:act"] }
          : token === "read"
            ? { accountId: a.accountId, audience: "mcp", scopes: ["world:read"] }
            : null,
    };
  registerActionEffectsRoutes(
    app,
    actionEffectsAuthenticator(identity as never, oauth as never),
    f.effects,
    f.dispatcher,
  );
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/agent-action-effects/execute",
        headers: { authorization: "Bearer read", "mcp-session-id": a.principal.sessionId },
        payload: g,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/v1/agent-action-effects/execute",
        headers: { authorization: "Bearer valid" },
        payload: g,
      })
    ).statusCode,
  ).toBe(403);
  const submitted = await app.inject({
    method: "POST",
    url: "/v1/agent-action-effects/execute",
    headers: { authorization: "Bearer valid", "mcp-session-id": a.principal.sessionId },
    payload: g,
  });
  expect(submitted.json().code).toBe("COMMITTED");
  await app.close();
});
