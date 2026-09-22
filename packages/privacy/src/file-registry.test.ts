import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileDeletionRegistry } from "./file-registry.js";

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true });
  directory = undefined;
});

describe("FileDeletionRegistry", () => {
  it("durably appends opaque tombstones and compacts expired records", async () => {
    directory = await mkdtemp(join(tmpdir(), "pact-deletion-registry-"));
    const path = join(directory, "registry.ndjson");
    const registry = new FileDeletionRegistry(path);
    const requestedAt = new Date("2026-09-22T00:00:00.000Z");
    await registry.append({
      deletionId: "11111111-1111-4111-8111-111111111111",
      productScope: "pact",
      accountId: "22222222-2222-4222-8222-222222222222",
      requestedAt,
      livePurgeDueAt: new Date("2026-10-22T00:00:00.000Z"),
      backupSuppressUntil: new Date("2026-11-26T00:00:00.000Z"),
    });
    expect(await registry.read()).toHaveLength(1);
    expect(await readFile(path, "utf8")).not.toContain("email");

    await registry.compact(new Date("2026-11-27T00:00:00.000Z"));
    expect(await registry.read()).toEqual([]);
  });
});
