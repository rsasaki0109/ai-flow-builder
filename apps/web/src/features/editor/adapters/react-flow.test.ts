import type { FlowEdge, FlowGraph, FlowNode } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  applyReactFlowEdgeChanges,
  applyReactFlowNodeChanges,
  toReactFlowEdges,
  toReactFlowNodes,
  type ReactFlowEdge,
  type ReactFlowNode,
} from "./react-flow.js";

describe("React Flow adapters", () => {
  it("converts FlowGraph nodes and edges to React Flow models", () => {
    const graph = createGraph();

    const [reactNode] = toReactFlowNodes(graph);
    const [reactEdge] = toReactFlowEdges(graph);

    expect(reactNode).toMatchObject({
      data: {
        kind: "core.input.text",
        label: "Text Input",
      },
      id: "10000000-0000-4000-8000-000000000101",
      position: { x: 0, y: 0 },
      type: "core.input.text",
    });
    expect(reactNode).not.toHaveProperty("measured");
    expect(reactNode).not.toHaveProperty("selected");
    expect(reactEdge).toMatchObject({
      id: "10000000-0000-4000-8000-000000000301",
      source: "10000000-0000-4000-8000-000000000101",
      sourceHandle: "value",
      target: "10000000-0000-4000-8000-000000000102",
      targetHandle: "value",
      type: "default",
    });
    expect(reactEdge).not.toHaveProperty("selected");
    expect(reactEdge).not.toHaveProperty("zIndex");
  });

  it("does not leak React Flow node internals into FlowGraph on add and position changes", () => {
    const graph = createEmptyGraph();
    const reactNode = createReactFlowNode({
      measured: { height: 80, width: 200 },
      position: { x: 50, y: 60 },
      selected: true,
      zIndex: 9,
    });

    const addedGraph = applyReactFlowNodeChanges(graph, [
      { item: reactNode, type: "add" },
    ]);
    const movedGraph = applyReactFlowNodeChanges(addedGraph, [
      {
        dragging: true,
        id: reactNode.id,
        position: { x: 100, y: 120 },
        positionAbsolute: { x: 100, y: 120 },
        type: "position",
      },
      {
        dimensions: { height: 90, width: 220 },
        id: reactNode.id,
        type: "dimensions",
      },
      {
        id: reactNode.id,
        selected: false,
        type: "select",
      },
    ]);

    expect(addedGraph.nodes[0]).toEqual({
      config: {
        key: "input",
        label: "Input",
        required: true,
      },
      id: reactNode.id,
      kind: "core.input.text",
      label: "Text Input",
      position: { x: 50, y: 60 },
      specVersion: 1,
    });
    expect(movedGraph.nodes[0]?.position).toEqual({ x: 100, y: 120 });
    expect(movedGraph.nodes[0]).not.toHaveProperty("measured");
    expect(movedGraph.nodes[0]).not.toHaveProperty("selected");
    expect(movedGraph.nodes[0]).not.toHaveProperty("dragging");
    expect(movedGraph.nodes[0]).not.toHaveProperty("zIndex");
  });

  it("replaces and removes nodes while dropping incident edges", () => {
    const graph = createGraph();
    const replacementNode = createReactFlowNode({
      data: {
        flowNode: {
          ...createTextInputNode("10000000-0000-4000-8000-000000000101"),
          label: "Updated Input",
        },
        kind: "core.input.text",
        label: "Updated Input",
      },
      id: "10000000-0000-4000-8000-000000000101",
      position: { x: 10, y: 20 },
      selected: true,
    });

    const replacedGraph = applyReactFlowNodeChanges(graph, [
      {
        id: "10000000-0000-4000-8000-000000000101",
        item: replacementNode,
        type: "replace",
      },
    ]);
    const removedGraph = applyReactFlowNodeChanges(replacedGraph, [
      {
        id: "10000000-0000-4000-8000-000000000101",
        type: "remove",
      },
    ]);

    expect(replacedGraph.nodes[0]).toMatchObject({
      id: "10000000-0000-4000-8000-000000000101",
      label: "Updated Input",
      position: { x: 10, y: 20 },
    });
    expect(removedGraph.nodes.map((node) => node.id)).toEqual([
      "10000000-0000-4000-8000-000000000102",
    ]);
    expect(removedGraph.edges).toHaveLength(0);
  });

  it("does not leak React Flow edge internals into FlowGraph on add and replace", () => {
    const graph = createEmptyGraph();
    const reactEdge = createReactFlowEdge({
      animated: true,
      selected: true,
      zIndex: 10,
    });

    const addedGraph = applyReactFlowEdgeChanges(graph, [
      { item: reactEdge, type: "add" },
    ]);
    const replacedGraph = applyReactFlowEdgeChanges(addedGraph, [
      {
        id: reactEdge.id,
        item: {
          ...reactEdge,
          sourceHandle: "text",
          targetHandle: "input",
        },
        type: "replace",
      },
      {
        id: reactEdge.id,
        selected: false,
        type: "select",
      },
    ]);

    expect(addedGraph.edges[0]).toEqual({
      id: reactEdge.id,
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "value",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "value",
      },
    });
    expect(replacedGraph.edges[0]).toEqual({
      id: reactEdge.id,
      source: {
        nodeId: "10000000-0000-4000-8000-000000000101",
        portId: "text",
      },
      target: {
        nodeId: "10000000-0000-4000-8000-000000000102",
        portId: "input",
      },
    });
    expect(replacedGraph.edges[0]).not.toHaveProperty("animated");
    expect(replacedGraph.edges[0]).not.toHaveProperty("selected");
    expect(replacedGraph.edges[0]).not.toHaveProperty("zIndex");
  });

  it("removes edges by id", () => {
    const graph = createGraph();

    const nextGraph = applyReactFlowEdgeChanges(graph, [
      {
        id: "10000000-0000-4000-8000-000000000301",
        type: "remove",
      },
    ]);

    expect(nextGraph.edges).toHaveLength(0);
    expect(graph.edges).toHaveLength(1);
  });
});

function createGraph(): FlowGraph {
  return {
    ...createEmptyGraph(),
    edges: [
      {
        id: "10000000-0000-4000-8000-000000000301",
        source: {
          nodeId: "10000000-0000-4000-8000-000000000101",
          portId: "value",
        },
        target: {
          nodeId: "10000000-0000-4000-8000-000000000102",
          portId: "value",
        },
      },
    ],
    nodes: [
      createTextInputNode("10000000-0000-4000-8000-000000000101"),
      createTextOutputNode("10000000-0000-4000-8000-000000000102"),
    ],
  };
}

function createEmptyGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

function createTextInputNode(id: string): FlowNode {
  return {
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
    id,
    kind: "core.input.text",
    label: "Text Input",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function createTextOutputNode(id: string): FlowNode {
  return {
    config: {
      key: "result",
      label: "Result",
    },
    id,
    kind: "core.output.text",
    label: "Text Output",
    position: { x: 300, y: 0 },
    specVersion: 1,
  };
}

function createReactFlowNode(
  overrides: Partial<ReactFlowNode> = {},
): ReactFlowNode {
  const flowNode = createTextInputNode("10000000-0000-4000-8000-000000000201");

  return {
    data: {
      flowNode,
      kind: flowNode.kind,
      label: flowNode.label,
    },
    id: flowNode.id,
    position: { x: 0, y: 0 },
    type: flowNode.kind,
    ...overrides,
  };
}

function createReactFlowEdge(
  overrides: Partial<ReactFlowEdge> = {},
): ReactFlowEdge {
  const flowEdge: FlowEdge = {
    id: "10000000-0000-4000-8000-000000000401",
    source: {
      nodeId: "10000000-0000-4000-8000-000000000101",
      portId: "value",
    },
    target: {
      nodeId: "10000000-0000-4000-8000-000000000102",
      portId: "value",
    },
  };

  return {
    data: {
      flowEdge,
    },
    id: flowEdge.id,
    source: flowEdge.source.nodeId,
    sourceHandle: flowEdge.source.portId,
    target: flowEdge.target.nodeId,
    targetHandle: flowEdge.target.portId,
    type: "default",
    ...overrides,
  };
}
