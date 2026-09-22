import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DeletionRegistryStore, DeletionTombstone } from "./service.js";

interface StoredTombstone {
  deletionId: string;
  productScope: string;
  accountId: string;
  requestedAt: string;
  livePurgeDueAt: string;
  backupSuppressUntil: string;
}

function serialize(tombstone: DeletionTombstone): StoredTombstone {
  return {
    deletionId: tombstone.deletionId,
    productScope: tombstone.productScope,
    accountId: tombstone.accountId,
    requestedAt: tombstone.requestedAt.toISOString(),
    livePurgeDueAt: tombstone.livePurgeDueAt.toISOString(),
    backupSuppressUntil: tombstone.backupSuppressUntil.toISOString(),
  };
}

function parse(line: string): DeletionTombstone | undefined {
  try {
    const value = JSON.parse(line) as Partial<StoredTombstone>;
    if (
      typeof value.deletionId !== "string" ||
      typeof value.productScope !== "string" ||
      typeof value.accountId !== "string" ||
      typeof value.requestedAt !== "string" ||
      typeof value.livePurgeDueAt !== "string" ||
      typeof value.backupSuppressUntil !== "string"
    ) {
      return undefined;
    }
    const tombstone = {
      deletionId: value.deletionId,
      productScope: value.productScope,
      accountId: value.accountId,
      requestedAt: new Date(value.requestedAt),
      livePurgeDueAt: new Date(value.livePurgeDueAt),
      backupSuppressUntil: new Date(value.backupSuppressUntil),
    };
    if (Object.values(tombstone).some((item) => item instanceof Date && Number.isNaN(item.getTime()))) return undefined;
    return tombstone;
  } catch {
    return undefined;
  }
}

export class FileDeletionRegistry implements DeletionRegistryStore {
  constructor(private readonly path: string) {}

  async append(tombstone: DeletionTombstone): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const file = await open(this.path, "a", 0o600);
    try {
      await file.writeFile(`${JSON.stringify(serialize(tombstone))}\n`, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
  }

  async read(): Promise<readonly DeletionTombstone[]> {
    let contents: string;
    try {
      contents = await readFile(this.path, "utf8");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
    const byAccount = new Map<string, DeletionTombstone>();
    for (const line of contents.split("\n")) {
      if (!line) continue;
      const tombstone = parse(line);
      if (!tombstone) throw new Error("Deletion registry contains an invalid record");
      const key = `${tombstone.productScope}:${tombstone.accountId}`;
      const existing = byAccount.get(key);
      if (!existing || existing.backupSuppressUntil < tombstone.backupSuppressUntil) byAccount.set(key, tombstone);
    }
    return [...byAccount.values()];
  }

  async compact(now: Date): Promise<void> {
    const active = (await this.read()).filter((item) => item.backupSuppressUntil > now);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.next`;
    await writeFile(
      temporary,
      active.map((item) => JSON.stringify(serialize(item))).join("\n") + (active.length ? "\n" : ""),
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
    await rename(temporary, this.path);
  }
}
