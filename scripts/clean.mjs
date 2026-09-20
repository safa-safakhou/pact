import { glob, rm } from "node:fs/promises";

for await (const path of glob("{apps,services,workers,packages}/*/dist")) {
  await rm(path, { recursive: true, force: true });
}
