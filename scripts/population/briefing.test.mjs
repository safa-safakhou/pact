import assert from "node:assert/strict";
import test from "node:test";
import { playerBrief, receiptBrief } from "./briefing.mjs";

test("reports receive whole charges, not easily confused marked balances", () => {
  assert.deepEqual(
    receiptBrief([
      {
        action: { kind: "game.building.queue" },
        receipt: {
          code: "COMMITTED",
          charged: [
            { asset: "iron", units: "30000" },
            { asset: "silver", units: "15000" },
          ],
        },
      },
    ])[0].chargedWhole,
    [
      { resource: "iron", whole: "50" },
      { resource: "silver", whole: "25" },
    ],
  );
});
test("resource briefing preserves server facts and distinguishes missing receipts", () => {
  const facts = { ordinaryWhole: "3", rates: { net: { perHourWhole: "10", perMinuteWhole: "≈0.166666" } } };
  assert.deepEqual(playerBrief({ resources: { silver: { facts, ordinaryMarked: "1800" } } }).resources.silver, facts);
  assert.equal(
    receiptBrief([{ action: {}, receipt: { code: "CONTACT_REQUIRED", receiptExists: false } }])[0].receiptExists,
    false,
  );
});

test("reserve floors and actual deliveries use the same exact whole units", () => {
  const source = {
    resources: {},
    mandate: { reserveFloorsMarked: { grain: "12000" } },
    consequences: {
      supplyContracts: [{ deliveries: [{ deliveredMarked: "360", dueMarked: "400", failedInstallments: 0 }] }],
    },
  };
  const b = playerBrief(source);
  assert.deepEqual(b.mandate.reserveFloorsWhole, { grain: "20" });
  assert.deepEqual(b.consequences.supplyContracts[0].deliveries[0], {
    deliveredWhole: "0.6",
    dueWhole: "≈0.666666",
    failedInstallments: 0,
  });
  assert.equal(source.consequences.supplyContracts[0].deliveries[0].deliveredMarked, "360");
});
