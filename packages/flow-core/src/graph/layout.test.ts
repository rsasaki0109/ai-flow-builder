import { describe, expect, it } from "vitest";
import type { FlowEdge, FlowGraph, FlowNode } from "../schemas/flow-graph.js";
import {
  calculateNodeDepths,
  getNodePosition,
  layoutFlowGraph,
} from "./layout.js";

const inputId = "40000000-0000-4000-8000-000000000001";
const template1Id = "40000000-0000-4000-8000-000000000002";
const template2Id = "40000000-0000-4000-8000-000000000003";
const output1Id = "40000000-0000-4000-8000-000000000004";
const output2Id = "40000000-0000-4000-8000-000000000005";

const edgeId = (suffix: number) =>
  `50000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

const inputNode = (id: string = inputId): FlowNode => ({
  id,
  kind: "core.input.text",
  specVersion: 1,
  position: { x: 999, y: 999 },
  label: "Text Input",
  config: {
    key: "input",
    label: "Input",
    required: true,
  },
});

const templateNode = (id: string): FlowNode => ({
  id,
  kind: "core.text.template",
  specVersion: 1,
  position: { x: 999, y: 999 },
  label: "Text Template",
  config: {
    template: "{{input}}",
  },
});

const outputNode = (id: string): FlowNode => ({
  id,
  kind: "core.output.text",
  specVersion: 1,
  position: { x: 999, y: 999 },
  label: "Text Output",
  config: {
    key: "result",
    label: "Result",
  },
});

const edge = (
  suffix: number,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge => ({
  id: edgeId(suffix),
  source: {
    nodeId: sourceNodeId,
    portId: sourcePortId,
  },
  target: {
    nodeId: targetNodeId,
    portId: targetPortId,
  },
});

const graph = (nodes: FlowNode[], edges: FlowEdge[] = []): FlowGraph => ({
  schemaVersion: 1,
  nodes,
  edges,
  viewport: { x: 25, y: 50, zoom: 2 },
});

const positionSummary = (layout: FlowGraph) =>
  layout.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    position: node.position,
  }));

describe("layoutFlowGraph", () => {
  it("produces a stable snapshot and does not mutate the input graph", () => {
    const original = graph(
      [outputNode(output1Id), templateNode(template1Id), inputNode(inputId)],
      [
        edge(1, inputId, "value", template1Id, "input"),
        edge(2, template1Id, "text", output1Id, "value"),
      ],
    );

    const layout = layoutFlowGraph(original);

    expect(positionSummary(layout)).toMatchInlineSnapshot(`
      [
        {
          "id": "40000000-0000-4000-8000-000000000004",
          "kind": "core.output.text",
          "position": {
            "x": 600,
            "y": 0,
          },
        },
        {
          "id": "40000000-0000-4000-8000-000000000002",
          "kind": "core.text.template",
          "position": {
            "x": 300,
            "y": 0,
          },
        },
        {
          "id": "40000000-0000-4000-8000-000000000001",
          "kind": "core.input.text",
          "position": {
            "x": 0,
            "y": 0,
          },
        },
      ]
    `);
    expect(original.nodes.map((node) => node.position)).toEqual([
      { x: 999, y: 999 },
      { x: 999, y: 999 },
      { x: 999, y: 999 },
    ]);
    expect(layout.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("lays out branch layers by depth and node ID", () => {
    const layout = layoutFlowGraph(
      graph(
        [
          outputNode(output2Id),
          templateNode(template2Id),
          outputNode(output1Id),
          inputNode(inputId),
          templateNode(template1Id),
        ],
        [
          edge(1, inputId, "value", template2Id, "input"),
          edge(2, inputId, "value", template1Id, "input"),
          edge(3, template2Id, "text", output2Id, "value"),
          edge(4, template1Id, "text", output1Id, "value"),
        ],
      ),
    );

    expect(getNodePosition(layout, inputId)).toEqual({ x: 0, y: 0 });
    expect(getNodePosition(layout, template1Id)).toEqual({ x: 300, y: 0 });
    expect(getNodePosition(layout, template2Id)).toEqual({ x: 300, y: 160 });
    expect(getNodePosition(layout, output1Id)).toEqual({ x: 600, y: 0 });
    expect(getNodePosition(layout, output2Id)).toEqual({ x: 600, y: 160 });
  });

  it("uses a deterministic fallback for disconnected nodes", () => {
    const layout = layoutFlowGraph(
      graph([
        outputNode(output1Id),
        templateNode(template1Id),
        inputNode(inputId),
      ]),
    );

    expect(getNodePosition(layout, inputId)).toEqual({ x: 0, y: 0 });
    expect(getNodePosition(layout, template1Id)).toEqual({ x: 0, y: 160 });
    expect(getNodePosition(layout, output1Id)).toEqual({ x: 300, y: 0 });
  });

  it("exposes calculated depths for reuse by normalization pipelines", () => {
    const depths = calculateNodeDepths(
      graph(
        [inputNode(inputId), templateNode(template1Id), outputNode(output1Id)],
        [
          edge(1, inputId, "value", template1Id, "input"),
          edge(2, template1Id, "text", output1Id, "value"),
        ],
      ),
    );

    expect([...depths.entries()]).toEqual([
      [inputId, 0],
      [template1Id, 1],
      [output1Id, 2],
    ]);
  });
});
