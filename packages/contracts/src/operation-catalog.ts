import { z } from "zod";
export const operationCatalogVersion = "pact.operation-catalog.v1" as const;
export const OperationMetadataSchema = z
  .object({
    catalogVersion: z.literal(operationCatalogVersion),
    name: z.string().min(1).max(100),
    argumentContract: z.string().min(1).max(100),
    requiredScopes: z
      .array(z.enum(["world:read", "game:act"]))
      .min(1)
      .max(2),
    audience: z.literal("agent"),
    readOnly: z.boolean(),
    admission: z.literal("server_rechecks_current_state_and_authority"),
  })
  .strict();
export function operationMetadata(name: string, scopes: ("world:read" | "game:act")[], readOnly: boolean) {
  return OperationMetadataSchema.parse({
    catalogVersion: operationCatalogVersion,
    name,
    argumentContract: name,
    requiredScopes: scopes,
    audience: "agent",
    readOnly,
    admission: "server_rechecks_current_state_and_authority",
  });
}
// Field paths/codes only; no values, private message body or schema constants.
export function operationValidationDetail(name: string, issues: { path: PropertyKey[]; code: string }[]) {
  return {
    schemaId: name.slice(0, 100),
    errors: issues.slice(0, 8).map((e) => ({
      path: e.path.slice(0, 8).map((p) => String(p).slice(0, 80)),
      code: e.code,
    })),
    complete: issues.length <= 8,
  };
}
