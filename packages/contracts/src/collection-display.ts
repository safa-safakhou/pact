import { z } from "zod";
import { collectionPieces } from "./collection-catalog.js";

export const CollectionSlotsSchema = z
  .object({
    hall: z.string().max(200).nullable(),
    banner: z.string().max(200).nullable(),
    frame: z.string().max(200).nullable(),
    stamp: z.string().max(200).nullable(),
  })
  .strict();
export const CollectionDisplaySchema = z
  .object({
    slots: CollectionSlotsSchema,
    goals: z
      .array(z.enum(collectionPieces.map((p) => p.id)))
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
    publicCard: z
      .object({
        enabled: z.boolean(),
        title: z.string().max(64),
        slots: z
          .array(z.enum(["hall", "banner", "frame", "stamp"]))
          .max(4)
          .refine((ids) => new Set(ids).size === ids.length),
      })
      .strict(),
  })
  .strict();
const base = {
  schemaVersion: z.literal("pact.collection-command.v2"),
  commandId: z.uuid(),
  expectedVersion: z.number().int().min(0),
};
export const CollectionCommandSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("display"), display: CollectionDisplaySchema }).strict(),
  z
    .object({
      ...base,
      kind: z.literal("story"),
      storyId: z.uuid(),
      title: z.string().max(120),
      annotation: z.string().max(4000),
      incidentIds: z
        .array(z.uuid())
        .max(8)
        .refine((ids) => new Set(ids).size === ids.length),
      deleted: z.boolean(),
    })
    .strict(),
]);
export const CollectionQuerySchema = z
  .object({ beforeIncidentId: z.uuid().optional(), beforeInstanceId: z.uuid().optional() })
  .strict();
export type CollectionCommand = z.infer<typeof CollectionCommandSchema>;
export type CollectionDisplay = z.infer<typeof CollectionDisplaySchema>;
