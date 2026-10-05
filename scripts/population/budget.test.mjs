import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RequestBudget } from "./budget.mjs";

test("budget survives restart, charges failed attempts, blocks excess and expired requests", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pact-budget-"));
  try {
    const f = path.join(d, "budget.json");
    assert.equal(new RequestBudget(f, 2).take(1, 5), 1);
    assert.equal(new RequestBudget(f, 2).take(2, 5), 2);
    assert.throws(() => new RequestBudget(f, 2).take(3, 5), /BUDGET/);
    assert.equal(JSON.parse(fs.readFileSync(f)).requests, 2);
    assert.throws(() => new RequestBudget(path.join(d, "expired"), 2).take(5, 5), /DEADLINE/);
    assert.ok(!fs.existsSync(path.join(d, "expired")));
  } finally {
    fs.rmSync(d, { recursive: true });
  }
});
