import { describe, expect, it } from "vitest";
import { desertingTroopIds, foodPayer, type UpkeepTroop, upkeepPerMinute } from "./upkeep.js";

const troop = (n: number, type: UpkeepTroop["type"] = "spearman"): UpkeepTroop => ({
  id: `00000000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`,
  ownerKingdomId: "owner",
  hostKingdomId: "host",
  placement: "home",
  type,
});

describe("upkeep and desertion rules", () => {
  it("charges a visiting defender to its host, but a raider to its owner", () => {
    expect(foodPayer({ ...troop(1), placement: "visiting" })).toBe("host");
    expect(foodPayer({ ...troop(1), placement: "attacking" })).toBe("owner");
    expect(upkeepPerMinute([troop(1), troop(2, "rider"), troop(3, "ram")])).toBe(80n);
  });

  it("allocates exact 5% losses by type remainder and lowest UUID bytes", () => {
    const group = [
      ...Array.from({ length: 20 }, (_, n) => troop(n + 1)),
      ...Array.from({ length: 20 }, (_, n) => troop(n + 21, "archer")),
      ...Array.from({ length: 20 }, (_, n) => troop(n + 41, "rider")),
    ];
    expect(desertingTroopIds(group)).toEqual([troop(1).id, troop(21).id, troop(41).id]);
    expect(desertingTroopIds([...group].reverse())).toEqual(desertingTroopIds(group));
    expect(desertingTroopIds(group.slice(0, 10).concat(group.slice(10)))).toEqual(desertingTroopIds(group));
    expect(desertingTroopIds([troop(2), troop(1)])).toEqual([troop(1).id]);
  });
});
