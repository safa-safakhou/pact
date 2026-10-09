import { expect, it } from "vitest";
import { independentNotificationBatch } from "./batch.js";

it("delivers security mail despite game failure, and game notifications despite mail failure", async () => {
  const called: string[] = [],
    failed: string[] = [];
  expect(
    await independentNotificationBatch(
      async () => {
        called.push("security");
        return 1;
      },
      async () => {
        called.push("game");
        throw Error("fixture");
      },
      (p) => failed.push(p),
    ),
  ).toBe(1);
  expect(called).toEqual(["security", "game"]);
  expect(failed).toEqual(["game"]);
  expect(
    await independentNotificationBatch(
      async () => {
        throw Error("fixture");
      },
      async () => 2,
      (p) => failed.push(p),
    ),
  ).toBe(2);
  expect(failed).toEqual(["game", "security"]);
});
