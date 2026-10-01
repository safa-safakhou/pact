import { z } from "zod";
export const RunReportQuerySchema = z.object({ runId: z.uuid().optional() }).strict();
