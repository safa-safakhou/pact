import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionCharges, actionReceiptNotice, Kingdom, People, RaidOperations, ReportPanel } from "./game-app.js";
import type { ReportRead } from "./report-reader.js";

function reportPanel(report: ReportRead): string {
  return renderToStaticMarkup(
    createElement(ReportPanel, {
      report,
      social: null,
      viewerKingdomId: "synthetic-viewer",
      onRebuild: () => undefined,
    }),
  );
}

describe("report identity and follow-up", () => {
  it("labels the requested report and shows loading without an old result", () => {
    const html = reportPanel({ kind: "scout", id: "synthetic-scout", status: "loading" });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Scout · <code>synthetic-scout</code>");
    expect(html).toContain('role="status">Loading the selected report');
    expect(html).not.toContain("Defenders won");
  });

  it("distinguishes inaccessible reports from transport failures without claiming pending on HTTP 503", () => {
    for (const code of ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"]) {
      const html = reportPanel({
        kind: "raid_participant",
        id: "synthetic-battle",
        status: "failed",
        error: new Error(code),
      });
      expect(html).toContain('role="alert"');
      expect(html).toContain("Report unavailable to this session");
    }
    const outage = reportPanel({
      kind: "scout",
      id: "synthetic-scout",
      status: "failed",
      error: new Error("HTTP_503"),
    });
    expect(outage).toContain("HTTP 503");
    expect(outage).toContain("no game action was submitted");
    expect(outage).not.toContain("may still be pending");
  });

  it("offers review-only replacement navigation for the owner's losses, not public or zero-loss reports", () => {
    const battle = (ownerId: string, casualties: number): ReportRead => ({
      kind: "raid_participant",
      id: "synthetic-battle",
      status: "ready",
      value: {
        raidId: "synthetic-battle",
        status: "resolved",
        gameTimeMs: 60000,
        trace: {
          winner: "defender",
          casualtyGroups: [
            { ownerId, side: "attacker", casualties, participating: 8, byType: { spearman: casualties } },
          ],
        },
      },
    });
    const losses = reportPanel(battle("synthetic-viewer", 7));
    expect(losses).toContain("lost 7 of 8 troops");
    expect(losses).toContain("Replacements are not automatic or free");
    expect(losses).toContain("Review replacement training");
    expect(reportPanel(battle("synthetic-other", 7))).not.toContain("Review replacement training");
    expect(reportPanel(battle("synthetic-viewer", 0))).not.toContain("Review replacement training");
  });
});

function kingdom(level: number, queued = false): string {
  const view: ComponentProps<typeof Kingdom>["view"] = {
    audience: "owner",
    profile: { kingdomId: "synthetic-kingdom", handle: "synthetic", displayName: "Synthetic" },
    asOfGameTimeMs: 1790000000000,
    committedTickSequence: "1",
    worldStatus: "active",
    balances: {},
    buildings: [{ kind: "farm", level }],
    builders: [
      {
        slot: 1,
        instructionId: queued ? "synthetic-instruction" : null,
        kind: queued ? "farm" : null,
        state: queued ? "waiting" : null,
        dueGameTimeMs: null,
      },
    ],
    troops: [],
    training: [],
    upkeep: { perMinuteUnits: "0", hungry: false },
    contracts: [],
    raids: [],
    scouts: [],
    threats: [],
    records: [],
    forecast: { throughGameTimeMs: 1790003600000, assumption: "Synthetic", expected: {} },
  };
  return renderToStaticMarkup(
    createElement(Kingdom, {
      view,
      busy: false,
      act: async () => undefined,
      social: null,
      kingdomId: view.profile.kingdomId,
      onPeople: () => undefined,
    }),
  );
}

describe("construction guidance", () => {
  it("derives the next exact level from the committed building rather than resetting to II", () => {
    expect(kingdom(1)).toContain('readOnly="" value="2"');
    const developed = kingdom(3);
    expect(developed).toContain('readOnly="" value="4"');
    expect(developed).toContain("Next upgrade: farm 3 → 4");
    expect(developed).toContain("Missing stock or prerequisites can leave an instruction waiting");
    expect(developed).not.toContain('disabled="">Queue upgrade');
  });

  it("does not offer a downgrade or level VII at the development cap", () => {
    const html = kingdom(6);
    expect(html).toContain('disabled="">Maximum level reached');
    expect(html).toContain("Level VI is the development cap.");
    expect(html).not.toContain('value="7"');
  });

  it("explains a queued building without hiding its cancellation control", () => {
    const html = kingdom(3, true);
    expect(html).toContain('disabled="">Upgrade already queued');
    expect(html).toContain("Cancel slot 1");
  });
});

function people(accepted: boolean): string {
  const social: NonNullable<ComponentProps<typeof People>["social"]> = {
    contacts: accepted ? [{ kingdomId: "other", handle: "other", displayName: "Other" }] : [],
    requests: [],
    messages: [],
    supplyOffers: [],
    supplyContracts: [],
    garrisonOffers: [],
    garrisonContracts: [],
  };
  return renderToStaticMarkup(
    createElement(People, {
      client: {} as ComponentProps<typeof People>["client"],
      act: async () => undefined,
      busy: false,
      kingdomId: "self",
      social,
      target: "other",
      setTarget: () => undefined,
      confirmAction: () => undefined,
      hallLevel: 1,
      charges: [],
    }),
  );
}

describe("fresh contact guidance", () => {
  it("explains cold-contact cost and does not offer premature messages or transfers", () => {
    const html = people(false);
    expect(html).toContain("2 ordinary Silver, not founding allowance");
    expect(html).toContain("Messages and direct transfers need an accepted contact");
    expect(html).toContain('disabled="">Send message');
    expect(html).toContain('disabled="">Transfer');
  });

  it("keeps accepted-contact messaging and transfers available, but prevents redundant cold requests", () => {
    const html = people(true);
    expect(html).not.toContain('disabled="">Transfer');
    expect(html).toContain('disabled="">Request contact');
  });
});

function raidOperations(
  overrides: Partial<ComponentProps<typeof RaidOperations>> = {},
  raidOverrides: Partial<ComponentProps<typeof RaidOperations>["raids"][number]> = {},
): string {
  return renderToStaticMarkup(
    createElement(RaidOperations, {
      raids: [
        {
          raidId: "synthetic-raid",
          status: "declared",
          side: "attacker",
          role: "leader",
          otherKingdomId: "synthetic-other",
          lockGameTimeMs: 60000,
          dueGameTimeMs: 360000,
          ...raidOverrides,
        },
      ],
      gameTimeMs: 59999,
      worldStatus: "active",
      busy: false,
      confirmAction: () => undefined,
      readReport: () => undefined,
      ...overrides,
    }),
  );
}

describe("raid withdrawal guidance", () => {
  it("shows the exact server lock deadline and a leader's whole-raid consequences", () => {
    const html = raidOperations();
    expect(html).toContain("Battle lock:");
    expect(html).toContain("Withdrawal closes at this boundary.");
    expect(html).toContain("Withdrawing cancels the entire raid.");
    expect(html).toContain("Spent provisions and charges are not refunded.");
    expect(html).toContain('aria-label="Withdraw attack synthetic-raid">Withdraw attack');
    expect(html).not.toContain("Read battle report");
  });

  it("closes withdrawal at the exact committed boundary, and when already locked", () => {
    for (const html of [raidOperations({ gameTimeMs: 60000 }), raidOperations({}, { status: "locked" })]) {
      expect(html).toContain('disabled="">Withdrawal closed');
      expect(html).toContain("Locked through resolution.");
    }
  });

  it("limits contributor consequences and exposes no withdrawal for defenders or older snapshots", () => {
    expect(raidOperations({}, { role: "contributor" })).toContain("Withdrawing returns only your contribution.");
    const defender = raidOperations({}, { side: "defender", role: "defender" });
    expect(defender).toContain("Defense is automatic.");
    expect(defender).not.toContain("Withdraw attack");
    const legacy = raidOperations({
      raids: [
        {
          raidId: "legacy-raid",
          status: "declared",
          side: "attacker",
          otherKingdomId: "synthetic-other",
          dueGameTimeMs: 360000,
        },
      ],
    });
    expect(legacy).toContain("Lock deadline unavailable");
    expect(legacy).not.toContain("Withdraw attack");
  });

  it("blocks paused/pending actions and keeps reports on resolved operations only", () => {
    expect(raidOperations({ worldStatus: "paused" })).toContain('disabled="">Withdraw attack');
    expect(raidOperations({ busy: true })).toContain('disabled="">Withdraw attack');
    const resolved = raidOperations({}, { status: "resolved" });
    expect(resolved).toContain("Read battle report");
    expect(resolved).not.toContain("Withdraw attack");
    expect(raidOperations({}, { status: "canceled" })).not.toContain("Read battle report");
  });
});

describe("command receipt guidance", () => {
  it("keeps exact command IDs and does not confuse tick admission with a committed action", () => {
    const action = { kind: "game.raid.withdraw" as const, raidId: "synthetic-raid" };
    expect(actionReceiptNotice(action, { code: "COMMITTED", commandId: "synthetic-command" })).toBe(
      "game.raid.withdraw: COMMITTED · synthetic-command",
    );
    const paused = actionReceiptNotice(action, { code: "WORLD_PAUSED", commandId: "synthetic-command" });
    expect(paused).toContain("paused or a tick is pending");
    expect(paused).toContain("This action did not commit");
    expect(paused).toContain("synthetic-command");
  });

  it("explains a closed withdrawal window without changing other expired actions", () => {
    expect(
      actionReceiptNotice(
        { kind: "game.raid.withdraw", raidId: "synthetic-raid" },
        { code: "EXPIRED", commandId: "synthetic-command" },
      ),
    ).toContain("withdrawal window is closed");
    expect(
      actionReceiptNotice(
        { kind: "game.scout.start", targetKingdomId: "synthetic-target" },
        { code: "EXPIRED", commandId: "synthetic-command" },
      ),
    ).toBe("game.scout.start: EXPIRED · synthetic-command");
  });
});

describe("shared action charge guidance", () => {
  it("shows exact pools, regeneration and the exhausted warning without inventing a client-side allowance", () => {
    const html = renderToStaticMarkup(
      createElement(ActionCharges, {
        charges: [
          {
            kind: "scout",
            available: 0,
            capacity: 4,
            regenerationHours: 6,
            nextRegenerationGameTimeMs: 1790000000000,
            retryAtGameTimeMs: 1790000000000,
          },
          {
            kind: "raid",
            available: 3,
            capacity: 3,
            regenerationHours: 8,
            nextRegenerationGameTimeMs: null,
            retryAtGameTimeMs: null,
          },
        ],
      }),
    );
    expect(html).toContain("scout: 0 / 4");
    expect(html).toContain("raid: 3 / 3");
    expect(html).toContain("No charges available");
    expect(html).toContain("Pool full.");
    expect(html).toContain("game time.");
    expect(html).toContain("Shared by manual play and agents");
    expect(html).toContain("Regenerates one every 6 game hours");
  });

  it("does not manufacture full pools when an older snapshot has no charge data", () => {
    expect(renderToStaticMarkup(createElement(ActionCharges, { charges: [] }))).toBe("");
  });
});
