import { describe, expect, it } from "vitest";
import {
  flowGraphSchema,
  MAX_FLOW_EDGES,
  MAX_FLOW_NODES,
  MAX_NODE_LABEL_LENGTH,
  type FlowGraph,
} from "./flow-graph.js";

const nodeId = "11111111-1111-4111-8111-111111111111";
const edgeId = "22222222-2222-4222-8222-222222222222";

const createNode = (id: string = nodeId) => ({
  id,
  kind: "core.input.text" as const,
  specVersion: 1 as const,
  position: { x: 10, y: 20 },
  label: "Text Input",
  config: { key: "input" },
});

const validGraph: FlowGraph = {
  schemaVersion: 1,
  nodes: [createNode()],
  edges: [
    {
      id: edgeId,
      source: { nodeId, portId: "value" },
      target: { nodeId, portId: "input" },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("flowGraphSchema", () => {
  it("parses a valid graph document", () => {
    expect(flowGraphSchema.parse(validGraph)).toEqual(validGraph);
  });

  it("rejects unknown fields at every persisted layer", () => {
    const graphWithExtraField = {
      ...validGraph,
      unknown: true,
    };
    const nodeWithExtraField = {
      ...validGraph,
      nodes: [{ ...createNode(), selected: true }],
    };
    const edgeEndpointWithExtraField = {
      ...validGraph,
      edges: [
        {
          ...validGraph.edges[0],
          source: { nodeId, portId: "value", handleType: "source" },
        },
      ],
    };

    expect(flowGraphSchema.safeParse(graphWithExtraField).success).toBe(false);
    expect(flowGraphSchema.safeParse(nodeWithExtraField).success).toBe(false);
    expect(flowGraphSchema.safeParse(edgeEndpointWithExtraField).success).toBe(
      false,
    );
  });

  it("rejects invalid viewport values", () => {
    expect(
      flowGraphSchema.safeParse({
        ...validGraph,
        viewport: { x: Number.POSITIVE_INFINITY, y: 0, zoom: 1 },
      }).success,
    ).toBe(false);
    expect(
      flowGraphSchema.safeParse({
        ...validGraph,
        viewport: { x: 0, y: 0, zoom: 0.09 },
      }).success,
    ).toBe(false);
    expect(
      flowGraphSchema.safeParse({
        ...validGraph,
        viewport: { x: 0, y: 0, zoom: 4.01 },
      }).success,
    ).toBe(false);
  });

  it("enforces graph and node size limits", () => {
    const tooManyNodes = Array.from(
      { length: MAX_FLOW_NODES + 1 },
      (_, index) =>
        createNode(
          `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
        ),
    );
    const tooManyEdges = Array.from(
      { length: MAX_FLOW_EDGES + 1 },
      (_, index) => ({
        id: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
        source: { nodeId, portId: "value" },
        target: { nodeId, portId: "input" },
      }),
    );

    expect(
      flowGraphSchema.safeParse({ ...validGraph, nodes: tooManyNodes }).success,
    ).toBe(false);
    expect(
      flowGraphSchema.safeParse({ ...validGraph, edges: tooManyEdges }).success,
    ).toBe(false);
    expect(
      flowGraphSchema.safeParse({
        ...validGraph,
        nodes: [
          createNode(),
          {
            ...createNode("11111111-1111-4111-8111-999999999999"),
            label: "x".repeat(MAX_NODE_LABEL_LENGTH + 1),
          },
        ],
      }).success,
    ).toBe(false);
  });
});
