import {
  aiTextGenerateConfigSchema,
  MAX_FLOW_DESCRIPTION_LENGTH,
  MAX_FLOW_NAME_LENGTH,
  MAX_NODE_LABEL_LENGTH,
  textInputConfigSchema,
  textOutputConfigSchema,
  textTemplateConfigSchema,
} from "@ai-flow-builder/flow-core";
import { z } from "zod";

export const FLOW_PLAN_SCHEMA_NAME = "FlowPlan";
export const MAX_FLOW_PLAN_REF_LENGTH = 40;
export const MAX_FLOW_PLAN_NODES = 20;
export const MAX_FLOW_PLAN_EDGES = 40;

export const flowPlanRefSchema = z
  .string()
  .min(1)
  .max(MAX_FLOW_PLAN_REF_LENGTH)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/);

const flowPlanNodeBaseSchema = z.object({
  ref: flowPlanRefSchema,
  label: z.string().min(1).max(MAX_NODE_LABEL_LENGTH),
});

export const textInputFlowPlanNodeSchema = flowPlanNodeBaseSchema
  .extend({
    kind: z.literal("core.input.text"),
    config: textInputConfigSchema,
  })
  .strict();

export const textTemplateFlowPlanNodeSchema = flowPlanNodeBaseSchema
  .extend({
    kind: z.literal("core.text.template"),
    config: textTemplateConfigSchema,
  })
  .strict();

export const aiTextGenerateFlowPlanNodeSchema = flowPlanNodeBaseSchema
  .extend({
    kind: z.literal("ai.text.generate"),
    config: aiTextGenerateConfigSchema,
  })
  .strict();

export const textOutputFlowPlanNodeSchema = flowPlanNodeBaseSchema
  .extend({
    kind: z.literal("core.output.text"),
    config: textOutputConfigSchema,
  })
  .strict();

export const flowPlanNodeSchema = z.discriminatedUnion("kind", [
  textInputFlowPlanNodeSchema,
  textTemplateFlowPlanNodeSchema,
  aiTextGenerateFlowPlanNodeSchema,
  textOutputFlowPlanNodeSchema,
]);

export const flowPlanEdgeSchema = z
  .object({
    sourceRef: flowPlanRefSchema,
    sourcePort: z.string().min(1),
    targetRef: flowPlanRefSchema,
    targetPort: z.string().min(1),
  })
  .strict();

export const flowPlanSchema = z
  .object({
    title: z.string().min(1).max(MAX_FLOW_NAME_LENGTH),
    description: z.string().max(MAX_FLOW_DESCRIPTION_LENGTH),
    assumptions: z.array(z.string()),
    unsupportedRequirements: z.array(z.string()),
    nodes: z.array(flowPlanNodeSchema).min(1).max(MAX_FLOW_PLAN_NODES),
    edges: z.array(flowPlanEdgeSchema).max(MAX_FLOW_PLAN_EDGES),
  })
  .strict()
  .superRefine((plan, context) => {
    const seenRefs = new Set<string>();

    for (const [index, node] of plan.nodes.entries()) {
      if (seenRefs.has(node.ref)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate node ref "${node.ref}".`,
          path: ["nodes", index, "ref"],
        });
      }

      seenRefs.add(node.ref);
    }
  });

export type FlowPlan = z.infer<typeof flowPlanSchema>;
export type FlowPlanNode = z.infer<typeof flowPlanNodeSchema>;
export type FlowPlanEdge = z.infer<typeof flowPlanEdgeSchema>;
