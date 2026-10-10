import { randomUUID } from "node:crypto";
import { type CommandEnvelope, ProductScopeSchema } from "@pact/contracts";
import { SocialError, type SocialService, SupplyError, type SupplyService } from "@pact/kingdom";
import type { Pool, PoolClient } from "pg";
import { expect, it, vi } from "vitest";
import { agentRecovery } from "./agent-recovery.js";
import { CommandDispatcher } from "./dispatcher.js";
import { GameCommandHandler } from "./game-command-handler.js";

const principal = {
  accountId: randomUUID(),
  productScope: ProductScopeSchema.parse("pact"),
  audience: "human" as const,
};
it.each(["CONTRACT_CAPACITY", "OFFER_CLOSED", "OFFER_EXPIRED"] as const)(
  "preserves safe supply diagnostic %s and game recovery without widening authority",
  async (detail) => {
    const supply = {
      signOffer: async () => {
        throw new SupplyError(detail);
      },
    } as unknown as SupplyService;
    const handler = new GameCommandHandler(
      {} as SocialService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      supply,
    );
    const action = { kind: "game.supply.sign" as const, offerId: randomUUID(), version: 1 };
    await expect(handler.execute({} as PoolClient, principal, { ...command(), action }, 0)).rejects.toMatchObject({
      code: detail === "OFFER_EXPIRED" ? "EXPIRED" : "INVALID_COMMAND",
      detail: detail === "OFFER_EXPIRED" ? undefined : detail,
    });
    expect(agentRecovery(detail === "OFFER_EXPIRED" ? "EXPIRED" : "INVALID_COMMAND", detail)).not.toContain(
      "Correct the arguments",
    );
  },
);
function command() {
  return {
    schemaVersion: "pact.command.v1",
    commandId: randomUUID(),
    actor: {
      principalId: principal.accountId,
      productScope: principal.productScope,
      audience: "human",
      subject: { type: "account", id: principal.accountId },
    },
    action: { kind: "game.contact.request", recipientKingdomId: randomUUID(), note: "Test" },
    submittedAt: new Date().toISOString(),
  } as const;
}
it.each(["40001", "40P01"])(
  "returns truthful retry information for exhausted transaction conflict %s",
  async (code) => {
    const d = new CommandDispatcher({
      pool: { query: async () => ({ rows: [] }) } as unknown as Pool,
      productScope: "pact",
      clock: { now: () => new Date() },
      game: {
        admit: async () => {
          throw Object.assign(new Error("fixture"), { code });
        },
        execute: vi.fn(),
      },
    });
    await expect(d.dispatch(principal, command())).rejects.toMatchObject({
      code: "RATE_LIMITED",
      detail: "TRANSACTION_BUSY",
      retryAfterMs: 100,
    });
    expect(agentRecovery("RATE_LIMITED", "TRANSACTION_BUSY")).toContain("same command and ID");
  },
);
it.each(["game", "social"] as const)(
  "distinguishes tick admission waits from paused worlds for %s writes",
  async (surface) => {
    let state: "paused" | "tick_pending" = "tick_pending";
    const execute = vi.fn();
    const query = vi.fn(async (_sql: string) => ({ rows: [] }));
    const d = new CommandDispatcher({
      pool: { query } as unknown as Pool,
      productScope: "pact",
      clock: { now: () => new Date() },
      game: { admit: async () => ({ kind: state }), execute },
      social: { execute },
    });
    const call = () =>
      surface === "game"
        ? d.dispatch(principal, command())
        : d.dispatchSocial(principal, {
            schemaVersion: "pact.social-command.v1",
            commandId: randomUUID(),
            action: { kind: "invitation.accept-remembered" },
          });
    await expect(call()).rejects.toMatchObject({ code: "TICK_PENDING" });
    state = "paused";
    const result = await call();
    expect("receipt" in result ? result.receipt.code : result.code).toBe("WORLD_PAUSED");
    expect(execute).not.toHaveBeenCalled();
    expect(query.mock.calls.every(([sql]) => String(sql).startsWith("SELECT"))).toBe(true);
  },
);
it.each([
  "CONTACT_QUEUE_FULL",
  "MESSAGE_QUEUE_FULL",
  "REQUEST_EXISTS",
  "ALREADY_CONTACT",
  "NOT_CONTACT",
  "BLOCKED",
] as const)("preserves useful social denial %s without disclosing block details", async (code) => {
  const social = {
    requestContact: async () => {
      throw new SocialError(code);
    },
  } as unknown as SocialService;
  const handler = new GameCommandHandler(social);
  await expect(
    handler.execute(
      {} as PoolClient,
      principal,
      command() as CommandEnvelope & { action: ReturnType<typeof command>["action"] },
      0,
    ),
  ).rejects.toMatchObject({ code: ["NOT_CONTACT", "BLOCKED"].includes(code) ? "FORBIDDEN" : code });
  if (!["NOT_CONTACT", "BLOCKED"].includes(code)) expect(agentRecovery(code)).not.toContain("Correct the arguments");
});
