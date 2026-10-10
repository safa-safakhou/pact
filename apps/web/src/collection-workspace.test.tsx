import { collectionPieces, collectionSets } from "@pact/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type CollectionView, CollectionWorkspace, collectionSourceHref } from "./collection-workspace.js";
import { linkedGameTab } from "./game-navigation.js";

const view: CollectionView = {
  pieces: collectionPieces.map((p) => ({
    ...p,
    owned: p.id === "first_stone",
    earnedGameTimeMs: p.id === "first_stone" ? "60000" : null,
    source: null,
  })),
  sets: collectionSets.map((s) => ({ ...s, ownedPieces: s.id === "founding" ? 1 : 0, trophyOwned: false })),
  progress: { partners: 0, resources: [] },
  watermark: { pending: false, processed_game_time_ms: "60000" },
  failedEvents: 0,
  incidents: [],
  instances: [],
  nextIncidentId: null,
  nextInstanceId: null,
  stories: [],
  display: {
    slots: { hall: null, banner: null, frame: null, stamp: null },
    goals: [],
    publicCard: { enabled: false, title: "", slots: [] },
  },
  displayVersion: 0,
  entitlements: ["ornament.stone_marker"],
  randomFinishesEnabled: false,
};
describe("collection discovery and source navigation", () => {
  it("shows Founding immediately, honest owned/locked outcomes and no undiscovered set claims", () => {
    const html = renderToStaticMarkup(
      <CollectionWorkspace
        initialView={view}
        request={async () => ({})}
        ownerId="synthetic"
        handle="synthetic"
        canWrite={false}
      />,
    );
    expect(html).toContain("Hall of Stories");
    expect(html).toContain("Founding Archive");
    expect(html).not.toContain("Negotiator&#x27;s Desk");
    expect(html).toContain("Stone Marker, owned");
    expect(html).toContain("Courier&#x27;s Knot, locked");
    expect(html).toContain("random finishes disabled");
    expect(html).not.toMatch(/Start Envoy|Claim reward|daily streak/);
  });
  it("links retained participant sources through existing authorized projections and unavailable sources nowhere", () => {
    expect(collectionSourceHref(null)).toBeNull();
    for (const source of [
      { kind: "message", id: "m", peerKingdomId: "peer" },
      { kind: "supply-contract", id: "c", peerKingdomId: "peer" },
      { kind: "raid", id: "raid" },
      { kind: "court", id: "court", handle: "council" },
    ]) {
      const link = collectionSourceHref(source);
      expect(link).toBeTruthy();
      expect(linkedGameTab(link ?? "")).toBe(
        source.kind === "raid" ? "Chronicle" : source.kind === "court" ? "People" : null,
      );
    }
    expect(linkedGameTab("?collection=keepsakes")).toBe("Kingdom");
    expect(linkedGameTab("?display=synthetic")).toBe("Kingdom");
  });
});
