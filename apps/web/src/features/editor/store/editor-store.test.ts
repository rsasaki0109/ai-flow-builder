import type {
  FlowGraph,
  FlowNode,
  FlowResource,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import { createEditorStore } from "./editor-store.js";

describe("createEditorStore", () => {
  it("loads the initial FlowResource into isolated editor state", () => {
    const flow = createFlowResource({
      graph: {
        ...createEmptyGraph(),
        nodes: [createTextInputNode("10000000-0000-4000-8000-000000000101")],
      },
    });
    const store = createEditorStore(flow);

    flow.graph.nodes = [];

    expect(store.getState().flowId).toBe(flow.id);
    expect(store.getState().name).toBe("Test Flow");
    expect(store.getState().description).toBe("A store test flow");
    expect(store.getState().serverRevision).toBe(3);
    expect(store.getState().saveStatus).toBe("saved");
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().graph.nodes).toHaveLength(1);
  });

  it("marks metadata updates dirty without replacing the graph", () => {
    const store = createEditorStore(createFlowResource());
    const initialGraph = store.getState().graph;

    store.getState().setName("Renamed Flow");
    store.getState().setDescription(null);

    expect(store.getState().name).toBe("Renamed Flow");
    expect(store.getState().description).toBeNull();
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().saveStatus).toBe("dirty");
    expect(store.getState().graph).toBe(initialGraph);
  });

  it("adds, moves, configures, labels, and selects nodes immutably", () => {
    const store = createEditorStore(createFlowResource(), {
      createId: createQueuedIdFactory(["10000000-0000-4000-8000-000000000201"]),
    });
    const initialGraph = store.getState().graph;

    const nodeId = store
      .getState()
      .addNode("core.input.text", { x: 10, y: 20 });
    const graphAfterAdd = store.getState().graph;

    store.getState().moveNode(nodeId, { x: 30, y: 40 });
    const graphAfterMove = store.getState().graph;
    store.getState().updateNodeConfig(nodeId, {
      key: "topic",
      label: "Topic",
      required: false,
    });
    store.getState().updateNodeLabel(nodeId, "Topic Input");

    const [node] = store.getState().graph.nodes;
    expect(node).toMatchObject({
      config: {
        key: "topic",
        label: "Topic",
        required: false,
      },
      id: nodeId,
      kind: "core.input.text",
      label: "Topic Input",
      position: { x: 30, y: 40 },
    });
    expect(store.getState().selectedNodeId).toBe(nodeId);
    expect(initialGraph.nodes).toHaveLength(0);
    expect(graphAfterAdd).not.toBe(initialGraph);
    expect(graphAfterMove).not.toBe(graphAfterAdd);
    expect(graphAfterAdd.nodes[0]?.position).toEqual({ x: 10, y: 20 });
  });

  it("connects nodes and removes incident edges when nodes are removed", () => {
    const store = createEditorStore(createFlowResource(), {
      createId: createQueuedIdFactory([
        "10000000-0000-4000-8000-000000000301",
        "10000000-0000-4000-8000-000000000302",
        "10000000-0000-4000-8000-000000000303",
      ]),
    });
    const inputId = store.getState().addNode("core.input.text", { x: 0, y: 0 });
    const outputId = store
      .getState()
      .addNode("core.output.text", { x: 300, y: 0 });

    const edgeId = store
      .getState()
      .connect(
        { nodeId: inputId, portId: "value" },
        { nodeId: outputId, portId: "value" },
      );
    const graphWithEdge = store.getState().graph;

    store.getState().removeNodes([inputId]);

    expect(graphWithEdge.edges).toHaveLength(1);
    expect(store.getState().graph.nodes.map((node) => node.id)).toEqual([
      outputId,
    ]);
    expect(store.getState().graph.edges).toHaveLength(0);
    expect(store.getState().selectedEdgeId).toBeNull();
    expect(edgeId).toBe("10000000-0000-4000-8000-000000000303");
  });

  it("removes selected edges without mutating previous graph snapshots", () => {
    const store = createEditorStore(createFlowResource(), {
      createId: createQueuedIdFactory([
        "10000000-0000-4000-8000-000000000401",
        "10000000-0000-4000-8000-000000000402",
        "10000000-0000-4000-8000-000000000403",
      ]),
    });
    const inputId = store.getState().addNode("core.input.text", { x: 0, y: 0 });
    const outputId = store
      .getState()
      .addNode("core.output.text", { x: 300, y: 0 });
    const edgeId = store
      .getState()
      .connect(
        { nodeId: inputId, portId: "value" },
        { nodeId: outputId, portId: "value" },
      );
    const graphWithEdge = store.getState().graph;

    store.getState().removeEdges([edgeId]);

    expect(graphWithEdge.edges).toHaveLength(1);
    expect(store.getState().graph.edges).toHaveLength(0);
    expect(store.getState().selectedEdgeId).toBeNull();
  });

  it("tracks save lifecycle and applies saved resources", () => {
    const store = createEditorStore(createFlowResource());

    store.getState().setName("Unsaved Name");
    store.getState().markSaving();
    store.getState().markConflict(8);

    expect(store.getState().dirty).toBe(true);
    expect(store.getState().saveStatus).toBe("conflict");
    expect(store.getState().conflictRevision).toBe(8);

    store.getState().applySavedResource(
      createFlowResource({
        name: "Saved Name",
        revision: 8,
      }),
    );

    expect(store.getState().name).toBe("Saved Name");
    expect(store.getState().serverRevision).toBe(8);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().saveStatus).toBe("saved");
    expect(store.getState().conflictRevision).toBeNull();
  });

  it("replaces graph and viewport using cloned graph values", () => {
    const store = createEditorStore(createFlowResource());
    const replacement = {
      ...createEmptyGraph(),
      nodes: [createTextInputNode("10000000-0000-4000-8000-000000000501")],
    };

    store.getState().replaceGraph(replacement);
    replacement.nodes = [];
    store.getState().setViewport({ x: 12, y: 34, zoom: 1.5 });

    expect(store.getState().graph.nodes).toHaveLength(1);
    expect(store.getState().graph.viewport).toEqual({
      x: 12,
      y: 34,
      zoom: 1.5,
    });
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().selectedEdgeId).toBeNull();
  });
});

function createFlowResource(
  overrides: Partial<FlowResource> = {},
): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Test Flow",
    description: "A store test flow",
    graph: createEmptyGraph(),
    revision: 3,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createEmptyGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function createTextInputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.input.text",
    specVersion: 1,
    position: { x: 0, y: 0 },
    label: "Text Input",
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
  };
}

function createQueuedIdFactory(ids: readonly string[]): () => string {
  let nextIndex = 0;

  return () => {
    const id = ids[nextIndex];
    nextIndex += 1;

    if (id === undefined) {
      throw new Error("No queued test ID remains.");
    }

    return id;
  };
}
