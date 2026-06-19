import type { Edge, EdgeChange, Node, NodeChange } from "@xyflow/react";
import type {
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowNodeKind,
} from "@ai-flow-builder/flow-core";

export interface ReactFlowNodeData extends Record<string, unknown> {
  flowNode: FlowNode;
  kind: FlowNodeKind;
  label: string;
}

export interface ReactFlowEdgeData extends Record<string, unknown> {
  flowEdge: FlowEdge;
}

export type ReactFlowNode = Node<ReactFlowNodeData, FlowNodeKind>;
export type ReactFlowEdge = Edge<ReactFlowEdgeData, "default">;
export type ReactFlowNodeChange = NodeChange<ReactFlowNode>;
export type ReactFlowEdgeChange = EdgeChange<ReactFlowEdge>;

export function toReactFlowNodes(graph: FlowGraph): ReactFlowNode[] {
  return graph.nodes.map((node) => ({
    data: {
      flowNode: cloneValue(node),
      kind: node.kind,
      label: node.label,
    },
    id: node.id,
    position: cloneValue(node.position),
    type: node.kind,
  }));
}

export function toReactFlowEdges(graph: FlowGraph): ReactFlowEdge[] {
  return graph.edges.map((edge) => ({
    data: {
      flowEdge: cloneValue(edge),
    },
    id: edge.id,
    source: edge.source.nodeId,
    sourceHandle: edge.source.portId,
    target: edge.target.nodeId,
    targetHandle: edge.target.portId,
    type: "default",
  }));
}

export function applyReactFlowNodeChanges(
  graph: FlowGraph,
  changes: readonly ReactFlowNodeChange[],
): FlowGraph {
  let nextGraph = cloneGraph(graph);

  for (const change of changes) {
    switch (change.type) {
      case "add":
        nextGraph = addNode(
          nextGraph,
          sanitizeReactFlowNode(change.item),
          change.index,
        );
        break;
      case "dimensions":
      case "select":
        break;
      case "position":
        if (change.position !== undefined) {
          nextGraph = updateNodePosition(nextGraph, change.id, change.position);
        }
        break;
      case "remove":
        nextGraph = removeNode(nextGraph, change.id);
        break;
      case "replace":
        nextGraph = replaceNode(
          nextGraph,
          change.id,
          sanitizeReactFlowNode(change.item),
        );
        break;
    }
  }

  return nextGraph;
}

export function applyReactFlowEdgeChanges(
  graph: FlowGraph,
  changes: readonly ReactFlowEdgeChange[],
): FlowGraph {
  let nextGraph = cloneGraph(graph);

  for (const change of changes) {
    switch (change.type) {
      case "add":
        nextGraph = addEdge(
          nextGraph,
          sanitizeReactFlowEdge(change.item),
          change.index,
        );
        break;
      case "remove":
        nextGraph = removeEdge(nextGraph, change.id);
        break;
      case "replace":
        nextGraph = replaceEdge(
          nextGraph,
          change.id,
          sanitizeReactFlowEdge(change.item),
        );
        break;
      case "select":
        break;
    }
  }

  return nextGraph;
}

function addNode(
  graph: FlowGraph,
  node: FlowNode,
  index: number | undefined,
): FlowGraph {
  if (graph.nodes.some((existingNode) => existingNode.id === node.id)) {
    return replaceNode(graph, node.id, node);
  }

  return {
    ...graph,
    nodes: insertAt(graph.nodes, node, index),
  };
}

function replaceNode(
  graph: FlowGraph,
  nodeId: string,
  node: FlowNode,
): FlowGraph {
  let replaced = false;
  const nodes = graph.nodes.map((existingNode) => {
    if (existingNode.id !== nodeId) {
      return existingNode;
    }

    replaced = true;
    return node;
  });

  return replaced
    ? {
        ...graph,
        nodes,
      }
    : graph;
}

function removeNode(graph: FlowGraph, nodeId: string): FlowGraph {
  return {
    ...graph,
    edges: graph.edges.filter(
      (edge) => edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId,
    ),
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
  };
}

function updateNodePosition(
  graph: FlowGraph,
  nodeId: string,
  position: FlowNode["position"],
): FlowGraph {
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }

    changed = true;
    return {
      ...node,
      position: {
        x: position.x,
        y: position.y,
      },
    };
  });

  return changed
    ? {
        ...graph,
        nodes,
      }
    : graph;
}

function addEdge(
  graph: FlowGraph,
  edge: FlowEdge,
  index: number | undefined,
): FlowGraph {
  if (graph.edges.some((existingEdge) => existingEdge.id === edge.id)) {
    return replaceEdge(graph, edge.id, edge);
  }

  return {
    ...graph,
    edges: insertAt(graph.edges, edge, index),
  };
}

function replaceEdge(
  graph: FlowGraph,
  edgeId: string,
  edge: FlowEdge,
): FlowGraph {
  let replaced = false;
  const edges = graph.edges.map((existingEdge) => {
    if (existingEdge.id !== edgeId) {
      return existingEdge;
    }

    replaced = true;
    return edge;
  });

  return replaced
    ? {
        ...graph,
        edges,
      }
    : graph;
}

function removeEdge(graph: FlowGraph, edgeId: string): FlowGraph {
  return {
    ...graph,
    edges: graph.edges.filter((edge) => edge.id !== edgeId),
  };
}

function sanitizeReactFlowNode(node: ReactFlowNode): FlowNode {
  const flowNode = node.data.flowNode;

  return {
    config: cloneValue(flowNode.config),
    id: node.id,
    kind: flowNode.kind,
    label: flowNode.label,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    specVersion: flowNode.specVersion,
  };
}

function sanitizeReactFlowEdge(edge: ReactFlowEdge): FlowEdge {
  const flowEdge = edge.data?.flowEdge;

  return {
    id: edge.id,
    source: {
      nodeId: edge.source,
      portId: edge.sourceHandle ?? flowEdge?.source.portId ?? "",
    },
    target: {
      nodeId: edge.target,
      portId: edge.targetHandle ?? flowEdge?.target.portId ?? "",
    },
  };
}

function insertAt<TItem>(
  items: readonly TItem[],
  item: TItem,
  index: number | undefined,
): TItem[] {
  if (index === undefined || index < 0 || index >= items.length) {
    return [...items, item];
  }

  return [...items.slice(0, index), item, ...items.slice(index)];
}

function cloneGraph(graph: FlowGraph): FlowGraph {
  return cloneValue(graph);
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}
