import { expect, it } from "vitest";
import * as published from "./json-schema.js";
import { OperationMetadataSchema, operationMetadata, operationValidationDetail } from "./operation-catalog.js";

it("binds exported exact operation names/schemas to compatible version and authority metadata", () => {
  const tools = (Object.values(published) as unknown[]).filter(
    (v): v is { name: string; inputSchema: object } =>
      !!v && typeof v === "object" && "name" in v && "inputSchema" in v,
  );
  expect(tools.length).toBeGreaterThan(20);
  expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
  for (const t of tools) {
    expect(t.inputSchema).toBeTypeOf("object");
    expect(operationMetadata(t.name, ["world:read"], true)).toMatchObject({ name: t.name, argumentContract: t.name });
  }
  expect(
    OperationMetadataSchema.safeParse({
      ...operationMetadata("fixture_v1", ["world:read"], true),
      catalogVersion: "future",
    }).success,
  ).toBe(false);
});
it("bounds diagnostic paths without serializing private argument values", () => {
  const detail = operationValidationDetail(
    "fixture_v1",
    Array.from({ length: 20 }, () => ({ path: ["action", "body"], code: "invalid_type" })),
  );
  expect(detail.errors).toHaveLength(8);
  expect(detail.complete).toBe(false);
  expect(Object.keys(detail.errors[0] ?? {})).toEqual(["path", "code"]);
});
