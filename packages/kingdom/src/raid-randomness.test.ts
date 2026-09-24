import { describe, expect, it } from "vitest";
import { fairDieFromBytes, raidCommitment, raidDie, verifyRaidReveal } from "./raid-randomness.js";

const raidId = "00000000-0000-7000-8000-000000000001";
const rulesVersion = "pact-s1-v1";
const seed = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
const commitment = "ededa106baaea39037285ffd2cf311d2285b220865378e5883bcc8e2f047866f";

describe("raid randomness", () => {
  it("matches the published RFC 8785 commitment and dice fixture", () => {
    expect(seed.toString("base64url")).toBe("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8");
    expect(raidCommitment(seed, raidId, rulesVersion)).toBe(commitment);
    expect(raidDie(seed, raidId, rulesVersion, "attacker")).toBe(6);
    expect(raidDie(seed, raidId, rulesVersion, "defender")).toBe(1);
    expect(
      verifyRaidReveal({
        raidId,
        rulesVersion,
        commitment,
        status: "resolved",
        seed: seed.toString("base64url"),
        attackerDie: 6,
        defenderDie: 1,
      }),
    ).toBe(true);
  });

  it("rejects 252–255 and altered seed, raid, or rules version", () => {
    expect(fairDieFromBytes([252, 253, 254, 255])).toBeNull();
    expect(fairDieFromBytes([252, 255, 5])).toBe(6);
    const proof = {
      raidId,
      rulesVersion,
      commitment,
      status: "canceled" as const,
      seed: seed.toString("base64url"),
      attackerDie: 6,
      defenderDie: 1,
    };
    expect(verifyRaidReveal({ ...proof, seed: Buffer.alloc(32, 9).toString("base64url") })).toBe(false);
    expect(verifyRaidReveal({ ...proof, raidId: "00000000-0000-7000-8000-000000000002" })).toBe(false);
    expect(verifyRaidReveal({ ...proof, rulesVersion: "pact-s1-v2" })).toBe(false);
    expect(() => raidCommitment(seed, "AAAAAAAA-0000-7000-8000-000000000001", rulesVersion)).toThrow("INVALID_RAID_ID");
  });
});
