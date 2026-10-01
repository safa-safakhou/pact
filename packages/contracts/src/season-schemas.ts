import { z } from "zod";
export const SeasonReadQuerySchema = z.strictObject({ cohortStartGameTimeMs: z.number().int().safe().optional() });
