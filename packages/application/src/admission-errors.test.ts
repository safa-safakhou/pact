import { randomUUID } from "node:crypto";
import { type CommandEnvelope, ProductScopeSchema } from "@pact/contracts";
import { SocialError, type SocialService } from "@pact/kingdom";
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
