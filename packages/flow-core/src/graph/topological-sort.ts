import type { FlowGraph } from "../schemas/flow-graph.js";

export interface TopologicalSortSuccess {
  readonly status: "ok";
  readonly nodeIds: readonly string[];
  readonly layers: readonly (readonly string[])[];
}

export interface TopologicalSortCycle {
  readonly status: "cycle";
  readonly sortedNodeIds: readonly string[];
  readonly cycleNodeIds: readonly string[];
  readonly layers: readonly (readonly string[])[];
}

export type TopologicalSortResult =
  | TopologicalSortSuccess
  | TopologicalSortCycle;

export const topologicalSort = (graph: FlowGraph): TopologicalSortResult => {
  const nodeIds = [...new Set(graph.nodes.map((node) => node.id))].sort();
  const nodeIdSet = new Set(nodeIds);
  const outgoingNodeIds = new Map<string, string[]>();
  const inDegreeByNodeId = new Map<string, number>();

  for (const nodeId of nodeIds) {
    outgoingNodeIds.set(nodeId, []);
    inDegreeByNodeId.set(nodeId, 0);
  }

  for (const edge of graph.edges) {
    if (
      !nodeIdSet.has(edge.source.nodeId) ||
      !nodeIdSet.has(edge.target.nodeId)
    ) {
      continue;
    }

    outgoingNodeIds.get(edge.source.nodeId)?.push(edge.target.nodeId);
    inDegreeByNodeId.set(
      edge.target.nodeId,
      (inDegreeByNodeId.get(edge.target.nodeId) ?? 0) + 1,
    );
  }

  for (const targets of outgoingNodeIds.values()) {
    targets.sort();
  }

  const sortedNodeIds: string[] = [];
  const layers: string[][] = [];
  let currentLayer = nodeIds.filter(
    (nodeId) => (inDegreeByNodeId.get(nodeId) ?? 0) === 0,
  );

  while (currentLayer.length > 0) {
    const nextLayerCandidates = new Set<string>();
    layers.push(currentLayer);

    for (const nodeId of currentLayer) {
      sortedNodeIds.push(nodeId);

      for (const targetNodeId of outgoingNodeIds.get(nodeId) ?? []) {
        const nextInDegree = (inDegreeByNodeId.get(targetNodeId) ?? 0) - 1;
        inDegreeByNodeId.set(targetNodeId, nextInDegree);

        if (nextInDegree === 0) {
          nextLayerCandidates.add(targetNodeId);
        }
      }
    }

    currentLayer = [...nextLayerCandidates].sort();
  }

  if (sortedNodeIds.length === nodeIds.length) {
    return {
      status: "ok",
      nodeIds: sortedNodeIds,
      layers,
    };
  }

  const sortedNodeIdSet = new Set(sortedNodeIds);
  return {
    status: "cycle",
    sortedNodeIds,
    cycleNodeIds: nodeIds.filter((nodeId) => !sortedNodeIdSet.has(nodeId)),
    layers,
  };
};

export const hasCycle = (graph: FlowGraph): boolean =>
  topologicalSort(graph).status === "cycle";
