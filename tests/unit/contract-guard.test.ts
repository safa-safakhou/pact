import { expect, it } from "vitest";
import { checkPublishedContracts, contractFingerprint } from "../../scripts/lib/contract-guard.js";

it("rejects removed, narrowed or unversioned changed published schemas", () => {
  const v1 = { type: "string", enum: ["a", "b"] },
    published = { exampleV1: contractFingerprint(v1) };
  expect(() => checkPublishedContracts(published, { exampleV1: v1, exampleV2: { type: "number" } })).not.toThrow();
  for (const current of [{}, { exampleV1: { type: "string", enum: ["a"] } }, { exampleV1: { type: "number" } }])
    expect(() => checkPublishedContracts(published, current)).toThrow("PUBLISHED_CONTRACT_CHANGED");
});
