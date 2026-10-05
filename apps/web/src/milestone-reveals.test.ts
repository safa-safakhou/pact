import { describe, expect, it } from "vitest";
import type { ConsequenceView } from "./consequences.js";
import { MilestoneMemory, milestoneEvents } from "./milestone-reveals.js";

const base: ConsequenceView = { asOfGameTimeMs: 0, builds: [], contacts: [], supplyContracts: [] };
describe("confirmed milestone selection", () => {
  it("never celebrates queue success, timer expiry, denial, pending or routine ticks", () => {
    expect(
      milestoneEvents({
        ...base,
        asOfGameTimeMs: 999999,
        builds: [
          {
            id: "queued",
            building: "farm",
            targetLevel: 2,
            state: "active",
            dueGameTimeMs: 0,
            settledGameTimeMs: null,
          },
        ],
      }),
    ).toEqual([]);
    expect(milestoneEvents(undefined)).toEqual([]);
    expect(milestoneEvents(base)).toEqual([]);
  });
  it("selects only actual completed/accepted/positive-delivery keys", () => {
    const data: ConsequenceView = {
      ...base,
      builds: [
        { id: "build", building: "farm", targetLevel: 2, state: "completed", dueGameTimeMs: 0, settledGameTimeMs: 0 },
      ],
      contacts: [{ kingdomId: "peer", handle: "real", displayName: "Real", acceptedGameTimeMs: "10" }],
      supplyContracts: [
        {
          id: "contract",
          offerVersion: 1,
          status: "active",
          signedBy: ["a", "b"],
          counterparty: { handle: "real", displayName: "Real" },
          endGameTimeMs: 100,
          noticeEndGameTimeMs: null,
          closeReason: null,
          deliveries: [
            {
              resource: "grain",
              direction: "received",
              installments: 1,
              dueMarked: "600",
              deliveredMarked: "600",
              overflowMarked: "0",
              failedInstallments: 0,
              lastGameTimeMs: 0,
            },
          ],
        },
      ],
    };
    expect(milestoneEvents(data).map((e) => e.kind)).toEqual(["build", "contact", "delivery"]);
    expect(
      milestoneEvents({ ...data, supplyContracts: data.supplyContracts.map((c) => ({ ...c, deliveries: [] })) }).map(
        (e) => e.kind,
      ),
    ).toEqual(["build", "contact"]);
    expect(
      milestoneEvents({
        ...data,
        supplyContracts: data.supplyContracts.map((c) => ({
          ...c,
          deliveries: c.deliveries.map((d) => ({ ...d, deliveredMarked: "0" })),
        })),
      }).map((e) => e.kind),
    ).toEqual(["build", "contact"]);
  });
  it("primes old history silently; emits a new event once across refresh/reconnect/reload", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const event = { key: "build:real", kind: "build" as const, text: "Recorded" };
    const memory = new MilestoneMemory("owner", storage);
    expect(memory.observe([])).toEqual([]);
    expect(memory.observe([event])).toEqual([event]);
    expect(memory.observe([event])).toEqual([]);
    const reloaded = new MilestoneMemory("owner", storage);
    expect(reloaded.observe([event])).toEqual([]);
    expect(reloaded.observe([event])).toEqual([]);
    const later = { ...event, key: "build:later" };
    expect(reloaded.observe([event, later])).toEqual([later]);
    const other = new MilestoneMemory("other-owner", storage);
    expect(other.observe([event])).toEqual([]);
  });
  it("stays replay-safe within the view when storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw Error("disabled");
      },
      setItem: () => {
        throw Error("disabled");
      },
    };
    const memory = new MilestoneMemory("owner", storage),
      event = { key: "contact:real", kind: "contact" as const, text: "Accepted" };
    memory.observe([]);
    expect(memory.observe([event])).toEqual([event]);
    expect(memory.observe([event])).toEqual([]);
  });
});
