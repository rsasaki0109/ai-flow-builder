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

export const MAX_HISTORY_SNAPSHOTS = 50;

export interface EditorHistoryState {
  past: FlowGraph[];
  future: FlowGraph[];
  dragStart: FlowGraph | null;
}

export interface AutosaveSnapshot {
  graph: FlowGraph;
  name: string;
  description: string | null;
}

export interface AiGeneratedFlowDraft {
  readonly graph: FlowGraph;
}

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
  history: EditorHistoryState;
}

export interface EditorActions {
  setName: (name: string) => void;
  setDescription: (description: string | null) => void;
  replaceGraph: (graph: FlowGraph) => void;
  replaceGraphFromAi: (draft: AiGeneratedFlowDraft) => void;
  addNode: (kind: FlowNodeKind, position: NodePosition) => string;
  beginNodeDrag: () => void;
  endNodeDrag: () => void;
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
  applyAutosaveResult: (
    resource: FlowResource,
    savedSnapshot: AutosaveSnapshot,
  ) => void;
  applySavedResource: (resource: FlowResource) => void;
  undo: () => void;
  redo: () => void;
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
        commitGraphChange(state, {
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
    applyAutosaveResult(resource, savedSnapshot) {
      set((state) => {
        const currentMatchesSaved =
          state.name === savedSnapshot.name &&
          state.description === savedSnapshot.description &&
          areGraphsEqual(state.graph, savedSnapshot.graph);

        if (currentMatchesSaved) {
          return {
            ...state,
            conflictRevision: null,
            createdAt: resource.createdAt,
            description: resource.description,
            dirty: false,
            graph: cloneGraph(resource.graph),
            name: resource.name,
            saveStatus: "saved",
            serverRevision: resource.revision,
            updatedAt: resource.updatedAt,
          };
        }

        return {
          ...state,
          conflictRevision: null,
          dirty: true,
          saveStatus: "dirty",
          serverRevision: resource.revision,
          updatedAt: resource.updatedAt,
        };
      });
    },
    beginNodeDrag() {
      set((state) => {
        if (state.history.dragStart !== null) {
          return state;
        }

        return {
          ...state,
          history: {
            ...state.history,
            dragStart: cloneGraph(state.graph),
          },
        };
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
        commitGraphChange(state, {
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
    endNodeDrag() {
      set((state) => {
        const dragStart = state.history.dragStart;

        if (dragStart === null) {
          return state;
        }

        if (areGraphsEqual(dragStart, state.graph)) {
          return {
            ...state,
            history: {
              ...state.history,
              dragStart: null,
            },
          };
        }

        return markDirty({
          ...state,
          history: {
            dragStart: null,
            future: [],
            past: appendHistorySnapshot(state.history.past, dragStart),
          },
        });
      });
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
        const existingNode = state.graph.nodes.find(
          (node) => node.id === nodeId,
        );

        if (
          existingNode === undefined ||
          arePositionsEqual(existingNode.position, position)
        ) {
          return state;
        }

        const nodes = state.graph.nodes.map((node) =>
          node.id === nodeId ? { ...node, position } : node,
        );

        return commitGraphChange(
          state,
          {
            ...state,
            graph: {
              ...state.graph,
              nodes,
            },
          },
          { skipHistory: state.history.dragStart !== null },
        );
      });
    },
    redo() {
      set((state) => {
        const [nextGraph, ...remainingFuture] = state.history.future;

        if (nextGraph === undefined) {
          return state;
        }

        return markDirty({
          ...state,
          ...sanitizeSelectionForGraph(state, nextGraph),
          graph: cloneGraph(nextGraph),
          history: {
            dragStart: null,
            future: remainingFuture.map(cloneGraph),
            past: appendHistorySnapshot(state.history.past, state.graph),
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

        return commitGraphChange(state, {
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

        return commitGraphChange(state, {
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
      set((state) => replaceGraphInState(state, graph));
    },
    replaceGraphFromAi(draft) {
      set((state) => replaceGraphInState(state, draft.graph));
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
        areViewportsEqual(state.graph.viewport, viewport)
          ? state
          : commitGraphChange(state, {
              ...state,
              graph: {
                ...state.graph,
                viewport,
              },
            }),
      );
    },
    undo() {
      set((state) => {
        const previousGraph = state.history.past.at(-1);

        if (previousGraph === undefined) {
          return state;
        }

        return markDirty({
          ...state,
          ...sanitizeSelectionForGraph(state, previousGraph),
          graph: cloneGraph(previousGraph),
          history: {
            dragStart: null,
            future: prependHistorySnapshot(state.history.future, state.graph),
            past: state.history.past.slice(0, -1).map(cloneGraph),
          },
        });
      });
    },
    updateNodeConfig(nodeId, config) {
      set((state) => {
        let changed = false;
        const nextConfig = cloneValue(config);
        const nodes = state.graph.nodes.map((node) => {
          if (node.id !== nodeId || areValuesEqual(node.config, nextConfig)) {
            return node;
          }

          changed = true;
          return {
            ...node,
            config: nextConfig,
          };
        });

        return changed
          ? commitGraphChange(state, {
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
          ? commitGraphChange(state, {
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
    history: {
      dragStart: null,
      future: [],
      past: [],
    },
    name: flow.name,
    saveStatus: "saved",
    selectedEdgeId: null,
    selectedNodeId: null,
    serverRevision: flow.revision,
    updatedAt: flow.updatedAt,
  };
}

function replaceGraphInState<TState extends EditorState>(
  state: TState,
  graph: FlowGraph,
): TState {
  return commitGraphChange(state, {
    ...state,
    graph: cloneGraph(graph),
    selectedEdgeId: null,
    selectedNodeId: null,
  });
}

function commitGraphChange<TState extends EditorState>(
  currentState: TState,
  nextState: TState,
  options: { skipHistory?: boolean } = {},
): TState {
  if (areGraphsEqual(currentState.graph, nextState.graph)) {
    return nextState;
  }

  return markDirty({
    ...nextState,
    history:
      options.skipHistory === true
        ? nextState.history
        : {
            dragStart: nextState.history.dragStart,
            future: [],
            past: appendHistorySnapshot(
              currentState.history.past,
              currentState.graph,
            ),
          },
  });
}

function markDirty<TState extends EditorState>(state: TState): TState {
  return {
    ...state,
    conflictRevision: null,
    dirty: true,
    saveStatus: "dirty",
  };
}

function appendHistorySnapshot(
  snapshots: readonly FlowGraph[],
  graph: FlowGraph,
): FlowGraph[] {
  return [...snapshots, cloneGraph(graph)].slice(-MAX_HISTORY_SNAPSHOTS);
}

function prependHistorySnapshot(
  snapshots: readonly FlowGraph[],
  graph: FlowGraph,
): FlowGraph[] {
  return [cloneGraph(graph), ...snapshots].slice(0, MAX_HISTORY_SNAPSHOTS);
}

function sanitizeSelectionForGraph(
  state: EditorState,
  graph: FlowGraph,
): Pick<EditorState, "selectedEdgeId" | "selectedNodeId"> {
  const selectedNodeId =
    state.selectedNodeId !== null &&
    graph.nodes.some((node) => node.id === state.selectedNodeId)
      ? state.selectedNodeId
      : null;
  const selectedEdgeId =
    selectedNodeId === null &&
    state.selectedEdgeId !== null &&
    graph.edges.some((edge) => edge.id === state.selectedEdgeId)
      ? state.selectedEdgeId
      : null;

  return {
    selectedEdgeId,
    selectedNodeId,
  };
}

function cloneGraph(graph: FlowGraph): FlowGraph {
  return cloneValue(graph);
}

function arePositionsEqual(left: NodePosition, right: NodePosition): boolean {
  return left.x === right.x && left.y === right.y;
}

function areViewportsEqual(left: FlowViewport, right: FlowViewport): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

function areGraphsEqual(left: FlowGraph, right: FlowGraph): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function createRandomId(): string {
  return globalThis.crypto.randomUUID();
}
