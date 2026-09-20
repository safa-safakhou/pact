import { describe, expect, it } from "vitest";
import type { ProductScope, SubjectRef } from "./types.js";
import type { TransactionContext, UnitOfWork } from "./unit-of-work.js";

class FixtureUnitOfWork implements UnitOfWork {
  public committed: string[] = [];
  public delivered: string[] = [];

  async run<T>(productScope: ProductScope, operation: (context: TransactionContext) => Promise<T>): Promise<T> {
    const pending: string[] = [];
    const context: TransactionContext = {
      productScope,
      stock: {
        debit: async (_subject, asset, units) => {
          pending.push(`stock:${asset}:${units}`);
        },
      },
      authority: {
        reserve: async (_subject, asset, units) => {
          pending.push(`authority:${asset}:${units}`);
        },
      },
      receipts: {
        save: async (receipt) => {
          pending.push(`receipt:${receipt.commandId}`);
        },
      },
      outbox: {
        append: async (event) => {
          pending.push(`outbox:${event.eventId}`);
        },
      },
    };
    const result = await operation(context);
    this.committed.push(...pending);
    this.delivered.push(...pending.filter((value) => value.startsWith("outbox:")));
    return result;
  }
}

describe("platform unit of work boundary", () => {
  it("commits stock, authority, receipt, and outbox together while delivery remains an effect", async () => {
    const unit = new FixtureUnitOfWork();
    const subject: SubjectRef = { type: "kingdom", id: "k1" };
    const scope = "pact" as ProductScope;
    await unit.run(scope, async (tx) => {
      await tx.stock.debit(subject, "grain", 10n);
      await tx.authority.reserve(subject, "grain", 10n);
      await tx.receipts.save({
        schemaVersion: "pact.command.v1",
        commandId: "8c6cd695-f341-4f27-a63b-bb37223e2518",
        code: "COMMITTED",
        committedEventIds: [],
        recordVersions: {},
        charged: [],
      });
      await tx.outbox.append({
        schemaVersion: "pact.event.v1",
        eventId: "05502ff0-205e-48b4-a51f-0c5c08b5c921",
        productScope: scope,
        type: "fixture.completed",
        actor: subject,
        audience: [subject],
        gameTime: 0,
        occurredAt: "2026-09-20T00:00:00.000Z",
        relatedRecordId: "fixture:1",
        payload: {},
      });
    });
    expect(unit.committed).toEqual([
      "stock:grain:10",
      "authority:grain:10",
      "receipt:8c6cd695-f341-4f27-a63b-bb37223e2518",
      "outbox:05502ff0-205e-48b4-a51f-0c5c08b5c921",
    ]);
    expect(unit.delivered).toEqual(["outbox:05502ff0-205e-48b4-a51f-0c5c08b5c921"]);
  });

  it("commits nothing when the operation fails", async () => {
    const unit = new FixtureUnitOfWork();
    await expect(
      unit.run("pact" as ProductScope, async (tx) => {
        await tx.stock.debit({ type: "kingdom", id: "k1" }, "grain", 10n);
        throw new Error("fixture rollback");
      }),
    ).rejects.toThrow("fixture rollback");
    expect(unit.committed).toEqual([]);
  });
});
