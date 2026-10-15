import { expect, it } from "vitest";
import { assertionSchema } from "./schema-projection.js";

it("removes schema annotations while retaining named properties, literals and all constraints", () => {
  const schema = {
    type: "object",
    description: "Repeated context",
    properties: {
      description: { type: "string", minLength: 2, description: "prose" },
      literal: { const: { description: "literal data" } },
      choices: { enum: [{ title: "literal title" }] },
    },
    required: ["description"],
    additionalProperties: false,
  };
  expect(assertionSchema(schema)).toEqual({
    type: "object",
    properties: {
      description: { type: "string", minLength: 2 },
      literal: { const: { description: "literal data" } },
      choices: { enum: [{ title: "literal title" }] },
    },
    required: ["description"],
    additionalProperties: false,
  });
  expect(schema.description).toBe("Repeated context");
  expect(assertionSchema({ $schema: "http://json-schema.org/draft-07/schema#", type: "string", minLength: 2 })).toEqual(
    { type: "string", minLength: 2 },
  );
  expect(assertionSchema({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "string" })).toHaveProperty(
    "$schema",
  );
});
