import {
  getNodeSpec,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeKind,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { createStore, type StoreApi } from "zustand/vanilla";

export type SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

export type FlowViewport = FlowGraph["viewport"];
export type NodePosition = FlowNode["position"];
export type FlowEdgeEndpoint = FlowEdge["source"];

export interface EditorState {
  flowId: string;
  name: string;
  description: string | null;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  graph: FlowGraph;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  dirty: boolean;
  saveStatus: SaveStatus;
  conflictRevision: number | null;
}

export interface EditorActions {
  setName: (name: string) => void;
  setDescription: (description: string | null) => void;
  replaceGraph: (graph: FlowGraph) => void;
  addNode: (kind: FlowNodeKind, position: NodePosition) => string;
  moveNode: (nodeId: string, position: NodePosition) => void;
  updateNodeConfig: (nodeId: string, config: unknown) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  removeNodes: (nodeIds: readonly string[]) => void;
  connect: (source: FlowEdgeEndpoint, target: FlowEdgeEndpoint) => string;
  removeEdges: (edgeIds: readonly string[]) => void;
  setViewport: (viewport: FlowViewport) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  markSaving: () => void;
  markSaveError: () => void;
  markConflict: (currentRevision: number) => void;
  applySavedResource: (resource: FlowResource) => void;
}

export type EditorStore = EditorState & EditorActions;
export type EditorStoreApi = StoreApi<EditorStore>;

export interface EditorStoreDependencies {
  createId?: () => string;
}

export function createEditorStore(
  flow: FlowResource,
  dependencies: EditorStoreDependencies = {},
): EditorStoreApi {
  const createId = dependencies.createId ?? createRandomId;

  return createStore<EditorStore>((set) => ({
    ...createStateFromFlowResource(flow),
    addNode(kind, position) {
      const spec = getNodeSpec(kind, 1);
      const node: FlowNode = {
        id: createId(),
        kind,
        specVersion: 1,
        position,
        label: spec.defaultLabel,
        config: cloneValue(spec.defaultConfig),
      };

      set((state) =>
        markDirty({
          ...state,
          graph: {
            ...state.graph,
            nodes: [...state.graph.nodes, node],
          },
          selectedNodeId: node.id,
          selectedEdgeId: null,
        }),
      );

      return node.id;
    },
    applySavedResource(resource) {
      set({
        ...createStateFromFlowResource(resource),
        saveStatus: "saved",
      });
    },
    clearSelection() {
      set({
        selectedEdgeId: null,
        selectedNodeId: null,
      });
    },
    connect(source, target) {
      const edge: FlowEdge = {
        id: createId(),
        source,
        target,
      };

      set((state) =>
        markDirty({
          ...state,
          graph: {
            ...state.graph,
            edges: [...state.graph.edges, edge],
          },
          selectedEdgeId: edge.id,
          selectedNodeId: null,
        }),
      );

      return edge.id;
    },
    markConflict(currentRevision) {
      set({
        conflictRevision: currentRevision,
        dirty: true,
        saveStatus: "conflict",
      });
    },
    markSaveError() {
      set({
        saveStatus: "error",
      });
    },
    markSaving() {
      set({
        saveStatus: "saving",
      });
    },
    moveNode(nodeId, position) {
      set((state) => {
        if (!hasNode(state.graph, nodeId)) {
          return state;
        }

        const nodes = state.graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, position } : node,
        );

        return markDirty({
          ...state,
          graph: {
            ...state.graph,
            nodes,
          },
        });
      });
    },
    removeEdges(edgeIds) {
      const edgeIdSet = new Set(edgeIds);

      set((state) => {
        const edges = state.graph.edges.filter(
          (edge) => !edgeIdSet.has(edge.id),
        );

        if (edges.length === state.graph.edges.length) {
          return state;
        }

        return markDirty({
          ...state,
          graph: {
            ...state.graph,
            edges,
          },
          selectedEdgeId:
            state.selectedEdgeId !== null && edgeIdSet.has(state.selectedEdgeId)
              ? null
              : state.selectedEdgeId,
        });
      });
    },
    removeNodes(nodeIds) {
      const nodeIdSet = new Set(nodeIds);

      set((state) => {
        const nodes = state.graph.nodes.filter(
          (node) => !nodeIdSet.has(node.id),
        );

        if (nodes.length === state.graph.nodes.length) {
          return state;
        }

        const edges = state.graph.edges.filter(
          (edge) =>
            !nodeIdSet.has(edge.source.nodeId) &&
            !nodeIdSet.has(edge.target.nodeId),
        );
        const remainingEdgeIds = new Set(edges.map((edge) => edge.id));

        return markDirty({
          ...state,
          graph: {
            ...state.graph,
            edges,
            nodes,
          },
          selectedEdgeId:
            state.selectedEdgeId !== null &&
            !remainingEdgeIds.has(state.selectedEdgeId)
              ? null
              : state.selectedEdgeId,
          selectedNodeId:
            state.selectedNodeId !== null && nodeIdSet.has(state.selectedNodeId)
              ? null
              : state.selectedNodeId,
        });
      });
    },
    replaceGraph(graph) {
      set((state) =>
        markDirty({
          ...state,
          graph: cloneGraph(graph),
          selectedEdgeId: null,
          selectedNodeId: null,
        }),
      );
    },
    selectEdge(edgeId) {
      set({
        selectedEdgeId: edgeId,
        selectedNodeId: null,
      });
    },
    selectNode(nodeId) {
      set({
        selectedEdgeId: null,
        selectedNodeId: nodeId,
      });
    },
    setDescription(description) {
      set((state) =>
        state.description === description
          ? state
          : markDirty({
              ...state,
              description,
            }),
      );
    },
    setName(name) {
      set((state) =>
        state.name === name
          ? state
          : markDirty({
              ...state,
              name,
            }),
      );
    },
    setViewport(viewport) {
      set((state) =>
        markDirty({
          ...state,
          graph: {
            ...state.graph,
            viewport,
          },
        }),
      );
    },
    updateNodeConfig(nodeId, config) {
      set((state) => {
        let changed = false;
        const nodes = state.graph.nodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          changed = true;
          return {
            ...node,
            config,
          };
        });

        return changed
          ? markDirty({
              ...state,
              graph: {
                ...state.graph,
                nodes,
              },
            })
          : state;
      });
    },
    updateNodeLabel(nodeId, label) {
      set((state) => {
        let changed = false;
        const nodes = state.graph.nodes.map((node) => {
          if (node.id !== nodeId || node.label === label) {
            return node;
          }

          changed = true;
          return {
            ...node,
            label,
          };
        });

        return changed
          ? markDirty({
              ...state,
              graph: {
                ...state.graph,
                nodes,
              },
            })
          : state;
      });
    },
  }));
}

function createStateFromFlowResource(flow: FlowResource): EditorState {
  return {
    conflictRevision: null,
    createdAt: flow.createdAt,
    description: flow.description,
    dirty: false,
    flowId: flow.id,
    graph: cloneGraph(flow.graph),
    name: flow.name,
    saveStatus: "saved",
    selectedEdgeId: null,
    selectedNodeId: null,
    serverRevision: flow.revision,
    updatedAt: flow.updatedAt,
  };
}

function markDirty<TState extends EditorState>(state: TState): TState {
  return {
    ...state,
    conflictRevision: null,
    dirty: true,
    saveStatus: "dirty",
  };
}

function hasNode(graph: FlowGraph, nodeId: string): boolean {
  return graph.nodes.some((node) => node.id === nodeId);
}

function cloneGraph(graph: FlowGraph): FlowGraph {
  return cloneValue(graph);
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}
