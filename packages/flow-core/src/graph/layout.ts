import type { FlowGraph, FlowNode } from "../schemas/flow-graph.js";
import { topologicalSort } from "./topological-sort.js";

export const DEFAULT_LAYOUT_X_SPACING = 300;
export const DEFAULT_LAYOUT_Y_SPACING = 160;

export interface LayoutOptions {
  readonly xSpacing?: number;
  readonly ySpacing?: number;
  readonly sortKeyByNodeId?: (nodeId: string) => string;
}

export const layoutFlowGraph = (
  graph: FlowGraph,
  options: LayoutOptions = {},
): FlowGraph => {
  const xSpacing = options.xSpacing ?? DEFAULT_LAYOUT_X_SPACING;
  const ySpacing = options.ySpacing ?? DEFAULT_LAYOUT_Y_SPACING;
  const depthByNodeId = calculateNodeDepths(graph);
  const positionedByNodeId = calculatePositions({
    graph,
    depthByNodeId,
    xSpacing,
    ySpacing,
    sortKeyByNodeId: options.sortKeyByNodeId,
  });

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: positionedByNodeId.get(node.id) ?? { x: 0, y: 0 },
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
};

export const calculateNodeDepths = (
  graph: FlowGraph,
): ReadonlyMap<string, number> => {
  const nodeIds = graph.nodes.map((node) => node.id).sort();
  const nodeIdSet = new Set(nodeIds);
  const outgoingTargetsByNodeId = new Map<string, string[]>();
  const depthByNodeId = new Map<string, number>();

  for (const nodeId of nodeIds) {
    outgoingTargetsByNodeId.set(nodeId, []);
    depthByNodeId.set(nodeId, 0);
  }

  for (const edge of graph.edges) {
    if (
      !nodeIdSet.has(edge.source.nodeId) ||
      !nodeIdSet.has(edge.target.nodeId)
    ) {
      continue;
    }

    outgoingTargetsByNodeId.get(edge.source.nodeId)?.push(edge.target.nodeId);
  }

  for (const targets of outgoingTargetsByNodeId.values()) {
    targets.sort();
  }

  const sorted = topologicalSort(graph);
  const sortedNodeIds =
    sorted.status === "ok"
      ? sorted.nodeIds
      : [...sorted.sortedNodeIds, ...sorted.cycleNodeIds];

  for (const nodeId of sortedNodeIds) {
    const sourceDepth = depthByNodeId.get(nodeId) ?? 0;
    for (const targetNodeId of outgoingTargetsByNodeId.get(nodeId) ?? []) {
      depthByNodeId.set(
        targetNodeId,
        Math.max(depthByNodeId.get(targetNodeId) ?? 0, sourceDepth + 1),
      );
    }
  }

  for (const node of graph.nodes) {
    if (node.kind === "core.input.text") {
      depthByNodeId.set(node.id, 0);
    }
  }

  const maxDepth = Math.max(0, ...depthByNodeId.values());
  const outputDepth = Math.max(1, maxDepth);
  for (const node of graph.nodes) {
    if (node.kind === "core.output.text") {
      depthByNodeId.set(
        node.id,
        Math.max(depthByNodeId.get(node.id) ?? 0, outputDepth),
      );
    }
  }

  return depthByNodeId;
};

const calculatePositions = ({
  graph,
  depthByNodeId,
  xSpacing,
  ySpacing,
  sortKeyByNodeId,
}: {
  readonly graph: FlowGraph;
  readonly depthByNodeId: ReadonlyMap<string, number>;
  readonly xSpacing: number;
  readonly ySpacing: number;
  readonly sortKeyByNodeId: ((nodeId: string) => string) | undefined;
}): ReadonlyMap<string, { readonly x: number; readonly y: number }> => {
  const nodeIdsByDepth = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const depth = depthByNodeId.get(node.id) ?? 0;
    const nodeIds = nodeIdsByDepth.get(depth) ?? [];
    nodeIds.push(node.id);
    nodeIdsByDepth.set(depth, nodeIds);
  }

  const positionedByNodeId = new Map<string, { x: number; y: number }>();
  const sortedDepths = [...nodeIdsByDepth.keys()].sort((a, b) => a - b);

  for (const depth of sortedDepths) {
    const nodeIds = [...(nodeIdsByDepth.get(depth) ?? [])].sort((left, right) =>
      compareNodeIds(left, right, sortKeyByNodeId),
    );

    for (const [index, nodeId] of nodeIds.entries()) {
      positionedByNodeId.set(nodeId, {
        x: depth * xSpacing,
        y: index * ySpacing,
      });
    }
  }

  return normalizePositions(positionedByNodeId);
};

const compareNodeIds = (
  left: string,
  right: string,
  sortKeyByNodeId: ((nodeId: string) => string) | undefined,
): number => {
  const leftKey = sortKeyByNodeId?.(left) ?? left;
  const rightKey = sortKeyByNodeId?.(right) ?? right;
  const keyComparison = leftKey.localeCompare(rightKey);

  return keyComparison === 0 ? left.localeCompare(right) : keyComparison;
};

const normalizePositions = (
  positionedByNodeId: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >,
): ReadonlyMap<string, { readonly x: number; readonly y: number }> => {
  if (positionedByNodeId.size === 0) {
    return positionedByNodeId;
  }

  const minX = Math.min(
    ...[...positionedByNodeId.values()].map((position) => position.x),
  );
  const minY = Math.min(
    ...[...positionedByNodeId.values()].map((position) => position.y),
  );
  const normalized = new Map<string, { x: number; y: number }>();

  for (const [nodeId, position] of positionedByNodeId) {
    normalized.set(nodeId, {
      x: position.x - minX,
      y: position.y - minY,
    });
  }

  return normalized;
};

export const getNodePosition = (
  graph: FlowGraph,
  nodeId: string,
): FlowNode["position"] | null =>
  graph.nodes.find((node) => node.id === nodeId)?.position ?? null;
