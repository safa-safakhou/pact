import type { OutcomeKind, OutcomeOwner } from "./outcome-cards.js";
export const contextOwner = "preview-owner";
export function emptyContextOwner(): OutcomeOwner {
  return {
    audience: "owner",
    profile: { kingdomId: contextOwner },
    asOfGameTimeMs: 0,
    worldStatus: "active",
    builders: [],
    raids: [],
    threats: [],
    consequences: { asOfGameTimeMs: 0, builds: [], contacts: [], supplyContracts: [] },
  };
}
export function contextEvent(view: OutcomeOwner, kind: OutcomeKind): OutcomeOwner {
  const next = structuredClone(view);
  if (!next.consequences) return next;
  const c = next.consequences;
  if (kind === "build")
    c.builds = [
      {
        id: "fixture-build",
        building: "farm",
        targetLevel: 2,
        state: "completed",
        settledGameTimeMs: 0,
        dueGameTimeMs: 0,
      },
    ];
  if (kind === "contact")
    c.contacts = [
      { kingdomId: "fixture-peer", handle: "fixture_peer", displayName: "Synthetic peer", acceptedGameTimeMs: "0" },
    ];
  if (["delivery", "default"].includes(kind)) {
    const contract = {
      id: "fixture-contract",
      offerVersion: 1,
      status: kind === "default" ? "defaulted" : "active",
      signedBy: [contextOwner, "fixture-peer"],
      counterparty: { handle: "fixture_peer", displayName: "Synthetic peer" },
      endGameTimeMs: 3600000,
      noticeEndGameTimeMs: null,
      closeReason: kind === "default" ? "underfunded" : null,
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
    };
    c.supplyContracts = [contract];
  }
  if (kind === "raid") {
    next.threats = [{ kind: "raid", id: "fixture-raid", dueGameTimeMs: 600000 }];
    next.raids = [{ raidId: "fixture-raid", status: "declared", dueGameTimeMs: 600000 }];
  }
  if (kind === "waiting")
    next.builders = [{ instructionId: "fixture-wait", kind: "mine", state: "active", dueGameTimeMs: 600000 }];
  c.firstRetained ??= { build: null, contact: null, delivery: null };
  if (kind === "build")
    c.firstRetained.build ??= { recordId: "fixture-build", occurredGameTimeMs: 0, summary: "farm level 2 completed" };
  if (kind === "contact")
    c.firstRetained.contact ??= {
      recordId: "fixture-peer:0",
      occurredGameTimeMs: 0,
      summary: "Contact accepted with @fixture_peer",
    };
  if (kind === "delivery")
    c.firstRetained.delivery ??= {
      recordId: "fixture-contract",
      occurredGameTimeMs: 0,
      summary: "Received 600 marked grain; overflow 0 marked (not credited)",
    };
  return next;
}
