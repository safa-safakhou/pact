// Provider packets need assertion contracts, not repeated schema annotations.
// Property/definition names and literal enum/const/default values are data.
export function assertionSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (value: unknown): unknown => {
    if (typeof value === "boolean") return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, v]) =>
            !["description", "title", "examples", "$comment"].includes(key) &&
            !(key === "$schema" && v === "http://json-schema.org/draft-07/schema#"),
        )
        .map(([key, v]) => {
          if (
            ["properties", "patternProperties", "definitions", "$defs", "dependentSchemas"].includes(key) &&
            v &&
            typeof v === "object" &&
            !Array.isArray(v)
          )
            return [key, Object.fromEntries(Object.entries(v).map(([name, shape]) => [name, walk(shape)]))];
          if (["anyOf", "oneOf", "allOf", "prefixItems"].includes(key) && Array.isArray(v)) return [key, v.map(walk)];
          if (
            [
              "not",
              "if",
              "then",
              "else",
              "items",
              "additionalItems",
              "contains",
              "propertyNames",
              "additionalProperties",
              "unevaluatedProperties",
              "unevaluatedItems",
            ].includes(key)
          )
            return [key, Array.isArray(v) ? v.map(walk) : walk(v)];
          return [key, v];
        }),
    );
  };
  return walk(schema) as Record<string, unknown>;
}
