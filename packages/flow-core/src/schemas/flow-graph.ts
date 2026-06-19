import { z } from "zod";

export const FLOW_GRAPH_SCHEMA_VERSION = 1;
export const MAX_FLOW_NODES = 100;
export const MAX_FLOW_EDGES = 200;
export const MAX_NODE_LABEL_LENGTH = 80;
export const MIN_VIEWPORT_ZOOM = 0.1;
export const MAX_VIEWPORT_ZOOM = 4;

export const flowNodeKindSchema = z.enum([
  "core.input.text",
  "core.text.template",
  "ai.text.generate",
  "core.output.text",
]);

export const finiteNumberSchema = z.number().finite();

export const nodePositionSchema = z
  .object({
    x: finiteNumberSchema,
    y: finiteNumberSchema,
  })
  .strict();

export const viewportSchema = z
  .object({
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    zoom: finiteNumberSchema.min(MIN_VIEWPORT_ZOOM).max(MAX_VIEWPORT_ZOOM),
  })
  .strict();

export const flowNodeSchema = z
  .object({
    id: z.uuid(),
    kind: flowNodeKindSchema,
    specVersion: z.literal(1),
    position: nodePositionSchema,
    label: z.string().min(1).max(MAX_NODE_LABEL_LENGTH),
    config: z.unknown(),
  })
  .strict();

export const flowEdgeEndpointSchema = z
  .object({
    nodeId: z.uuid(),
    portId: z.string().min(1),
  })
  .strict();

export const flowEdgeSchema = z
  .object({
    id: z.uuid(),
    source: flowEdgeEndpointSchema,
    target: flowEdgeEndpointSchema,
  })
  .strict();

export const flowGraphSchema = z
  .object({
    schemaVersion: z.literal(FLOW_GRAPH_SCHEMA_VERSION),
    nodes: z.array(flowNodeSchema).max(MAX_FLOW_NODES),
    edges: z.array(flowEdgeSchema).max(MAX_FLOW_EDGES),
    viewport: viewportSchema,
  })
  .strict();

export type FlowNodeKind = z.infer<typeof flowNodeKindSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowGraph = z.infer<typeof flowGraphSchema>;
