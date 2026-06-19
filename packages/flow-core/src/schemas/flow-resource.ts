import { z } from "zod";
import { flowGraphSchema } from "./flow-graph.js";

export const MAX_FLOW_NAME_LENGTH = 120;
export const MAX_FLOW_DESCRIPTION_LENGTH = 2_000;

export const flowResourceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(MAX_FLOW_NAME_LENGTH),
    description: z.string().max(MAX_FLOW_DESCRIPTION_LENGTH).nullable(),
    graph: flowGraphSchema,
    revision: z.number().int().min(1),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type FlowResource = z.infer<typeof flowResourceSchema>;
