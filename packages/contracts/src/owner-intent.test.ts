import { expect, it } from "vitest";
import { OwnedWorldIntentSchema, ownedWorldIntentVersion } from "./owner-intent.js";

const owned = {
  audience: "owner",
  ambition: "Develop reliable supply",
  asOfGameTimeMs: 1000,
  committedTickSequence: "17",
  profile: {
    kingdomId: "a7a3b2a7-1a20-4b91-8c2c-1bac6ab01405",
    handle: "synthetic_owner",
    displayName: "Synthetic owner",
    portrait: "founder",
  },
};
it("versions the real root-intent layout and admits the compatible unversioned owned response", () => {
  expect(OwnedWorldIntentSchema.parse(owned).ambition).toBe(owned.ambition);
  expect(OwnedWorldIntentSchema.parse({ ...owned, schemaVersion: ownedWorldIntentVersion }).ambition).toBe(
    owned.ambition,
  );
  expect(OwnedWorldIntentSchema.parse({ ...owned, ambition: "", asOfGameTimeMs: 2000 }).ambition).toBe("");
});
it("cannot certify a profile-intent fixture, public response or unsupported version", () => {
  const { ambition, ...missing } = owned;
  expect(OwnedWorldIntentSchema.safeParse({ ...missing, profile: { ...owned.profile, ambition } }).success).toBe(false);
  expect(OwnedWorldIntentSchema.safeParse({ ...owned, audience: "public" }).success).toBe(false);
  expect(OwnedWorldIntentSchema.safeParse({ ...owned, schemaVersion: "future" }).success).toBe(false);
});
