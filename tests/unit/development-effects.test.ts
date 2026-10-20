import { expect, it } from "vitest";
import { AgentGuideReader } from "../../packages/application/src/agent-guide.js";

it("publishes production roles and queue effects without reading or mutating owned state", async () => {
  const reader = new AgentGuideReader({} as never, {} as never, {} as never);
  const guide = await reader.read("synthetic", "development");
  expect(guide.productionBuildings).toEqual({ farm: "grain", mine: "iron", market: "silver" });
  expect(guide.constructionEffect).toEqual({
    admitted: "Adds one construction instruction; existing orders remain.",
    started: "Spends Iron/Silver construction stock; does not acquire resources.",
    completed: "Changes the selected building's level and effects only after completion.",
  });
});
