import type {
  FlowGraph,
  FlowNode,
  FlowResource,
} from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import { createEditorStore, MAX_HISTORY_SNAPSHOTS } from "./editor-store.js";

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
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().history.future).toHaveLength(0);
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
    expect(store.getState().history.past).toHaveLength(0);
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

  it("undoes and redoes graph edits while leaving metadata out of history", () => {
    const store = createEditorStore(createFlowResource(), {
      createId: createQueuedIdFactory(["10000000-0000-4000-8000-000000000601"]),
    });

    store.getState().setName("Metadata Only");
    expect(store.getState().history.past).toHaveLength(0);

    const nodeId = store
      .getState()
      .addNode("core.input.text", { x: 10, y: 20 });
    store.getState().updateNodeConfig(nodeId, {
      key: "topic",
      label: "Topic",
      required: false,
    });
    store.getState().updateNodeConfig(nodeId, {
      key: "topic",
      label: "Topic",
      required: false,
    });

    expect(store.getState().history.past).toHaveLength(2);
    expect(store.getState().graph.nodes[0]?.config).toMatchObject({
      key: "topic",
    });

    store.getState().undo();
    expect(store.getState().graph.nodes[0]?.config).toMatchObject({
      key: "input",
    });
    expect(store.getState().history.future).toHaveLength(1);

    store.getState().undo();
    expect(store.getState().graph.nodes).toHaveLength(0);
    expect(store.getState().history.future).toHaveLength(2);

    store.getState().redo();
    expect(store.getState().graph.nodes).toHaveLength(1);
    expect(store.getState().graph.nodes[0]?.config).toMatchObject({
      key: "input",
    });

    store.getState().redo();
    expect(store.getState().graph.nodes[0]?.config).toMatchObject({
      key: "topic",
    });
  });

  it("coalesces node drag moves into one history snapshot", () => {
    const nodeId = "10000000-0000-4000-8000-000000000701";
    const store = createEditorStore(
      createFlowResource({
        graph: {
          ...createEmptyGraph(),
          nodes: [createTextInputNode(nodeId)],
        },
      }),
    );

    store.getState().beginNodeDrag();
    store.getState().moveNode(nodeId, { x: 10, y: 20 });
    store.getState().moveNode(nodeId, { x: 30, y: 40 });

    expect(store.getState().graph.nodes[0]?.position).toEqual({
      x: 30,
      y: 40,
    });
    expect(store.getState().history.past).toHaveLength(0);

    store.getState().endNodeDrag();

    expect(store.getState().history.past).toHaveLength(1);
    expect(store.getState().history.past[0]?.nodes[0]?.position).toEqual({
      x: 0,
      y: 0,
    });

    store.getState().undo();
    expect(store.getState().graph.nodes[0]?.position).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("caps undo history at the configured maximum", () => {
    const ids = Array.from(
      { length: MAX_HISTORY_SNAPSHOTS + 5 },
      (_, index) =>
        `10000000-0000-4000-8000-${String(index + 800).padStart(12, "0")}`,
    );
    const store = createEditorStore(createFlowResource(), {
      createId: createQueuedIdFactory(ids),
    });

    for (let index = 0; index < ids.length; index += 1) {
      store.getState().addNode("core.input.text", { x: index, y: index });
    }

    expect(store.getState().history.past).toHaveLength(MAX_HISTORY_SNAPSHOTS);

    for (let index = 0; index < MAX_HISTORY_SNAPSHOTS; index += 1) {
      store.getState().undo();
    }

    expect(store.getState().graph.nodes).toHaveLength(5);
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

  it("applies autosave results without overwriting newer local graph changes", () => {
    const nodeId = "10000000-0000-4000-8000-000000000901";
    const initialFlow = createFlowResource({
      graph: {
        ...createEmptyGraph(),
        nodes: [createTextInputNode(nodeId)],
      },
    });
    const store = createEditorStore(initialFlow);

    store.getState().updateNodeLabel(nodeId, "Saved Label");
    const savedSnapshot = {
      description: store.getState().description,
      graph: store.getState().graph,
      name: store.getState().name,
    };

    store.getState().markSaving();
    store.getState().updateNodeLabel(nodeId, "Local Newer Label");
    store.getState().applyAutosaveResult(
      createFlowResource({
        graph: savedSnapshot.graph,
        revision: 4,
      }),
      savedSnapshot,
    );

    expect(store.getState().serverRevision).toBe(4);
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().saveStatus).toBe("dirty");
    expect(store.getState().graph.nodes[0]?.label).toBe("Local Newer Label");

    const latestSnapshot = {
      description: store.getState().description,
      graph: store.getState().graph,
      name: store.getState().name,
    };
    store.getState().markSaving();
    store.getState().applyAutosaveResult(
      createFlowResource({
        graph: latestSnapshot.graph,
        revision: 5,
      }),
      latestSnapshot,
    );

    expect(store.getState().serverRevision).toBe(5);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().saveStatus).toBe("saved");
    expect(store.getState().graph.nodes[0]?.label).toBe("Local Newer Label");
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

  it("applies an AI draft as one graph history snapshot and can undo it", () => {
    const originalNodeId = "10000000-0000-4000-8000-000000000101";
    const generatedNodeId = "10000000-0000-4000-8000-000000000501";
    const store = createEditorStore(
      createFlowResource({
        graph: {
          ...createEmptyGraph(),
          nodes: [createTextInputNode(originalNodeId)],
        },
      }),
    );

    store.getState().selectNode(originalNodeId);
    store.getState().replaceGraphFromAi({
      graph: {
        ...createEmptyGraph(),
        nodes: [createTextInputNode(generatedNodeId)],
      },
    });

    expect(store.getState().dirty).toBe(true);
    expect(store.getState().saveStatus).toBe("dirty");
    expect(store.getState().graph.nodes.map((node) => node.id)).toEqual([
      generatedNodeId,
    ]);
    expect(store.getState().history.past).toHaveLength(1);
    expect(
      store.getState().history.past[0]?.nodes.map((node) => node.id),
    ).toEqual([originalNodeId]);
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().selectedEdgeId).toBeNull();

    store.getState().undo();

    expect(store.getState().graph.nodes.map((node) => node.id)).toEqual([
      originalNodeId,
    ]);
    expect(store.getState().history.future).toHaveLength(1);
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().saveStatus).toBe("dirty");
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
