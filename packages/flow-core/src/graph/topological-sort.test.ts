import { describe, expect, it } from "vitest";
import type { FlowGraph, FlowNode } from "../schemas/flow-graph.js";
import { hasCycle, topologicalSort } from "./topological-sort.js";

const nodeId = (suffix: number) =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

const edgeId = (suffix: number) =>
  `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

const node = (id: string): FlowNode => ({
  id,
  kind: "core.text.template",
  specVersion: 1,
  position: { x: 0, y: 0 },
  label: "Template",
  config: { template: "{{input}}" },
});

const graph = (
  nodes: readonly FlowNode[],
  edges: readonly {
    readonly source: string;
    readonly target: string;
  }[],
): FlowGraph => ({
  schemaVersion: 1,
  nodes: [...nodes],
  edges: edges.map((edge, index) => ({
    id: edgeId(index + 1),
    source: {
      nodeId: edge.source,
      portId: "text",
    },
    target: {
      nodeId: edge.target,
      portId: "input",
    },
  })),
  viewport: { x: 0, y: 0, zoom: 1 },
});

describe("topologicalSort", () => {
  it("sorts a linear graph", () => {
    const a = nodeId(1);
    const b = nodeId(2);
    const c = nodeId(3);

    expect(
      topologicalSort(
        graph(
          [node(a), node(b), node(c)],
          [
            { source: a, target: b },
            { source: b, target: c },
          ],
        ),
      ),
    ).toEqual({
      status: "ok",
      nodeIds: [a, b, c],
      layers: [[a], [b], [c]],
    });
  });

  it("sorts a branch graph in deterministic layers", () => {
    const a = nodeId(1);
    const b = nodeId(2);
    const c = nodeId(3);
    const d = nodeId(4);

    expect(
      topologicalSort(
        graph(
          [node(d), node(c), node(b), node(a)],
          [
            { source: a, target: c },
            { source: a, target: b },
            { source: b, target: d },
            { source: c, target: d },
          ],
        ),
      ),
    ).toEqual({
      status: "ok",
      nodeIds: [a, b, c, d],
      layers: [[a], [b, c], [d]],
    });
  });

  it("sorts disconnected nodes by stable ID order", () => {
    const a = nodeId(1);
    const b = nodeId(2);
    const c = nodeId(3);
    const d = nodeId(4);

    expect(
      topologicalSort(graph([node(d), node(b), node(c), node(a)], [])),
    ).toEqual({
      status: "ok",
      nodeIds: [a, b, c, d],
      layers: [[a, b, c, d]],
    });
  });

  it("detects cycles and returns the sorted acyclic prefix", () => {
    const a = nodeId(1);
    const b = nodeId(2);
    const c = nodeId(3);
    const d = nodeId(4);
    const cyclicGraph = graph(
      [node(d), node(c), node(b), node(a)],
      [
        { source: a, target: b },
        { source: b, target: c },
        { source: c, target: b },
      ],
    );

    expect(topologicalSort(cyclicGraph)).toEqual({
      status: "cycle",
      sortedNodeIds: [a, d],
      cycleNodeIds: [b, c],
      layers: [[a, d]],
    });
    expect(hasCycle(cyclicGraph)).toBe(true);
  });

  it("uses node ID tie-breaks when multiple nodes become ready together", () => {
    const a = nodeId(1);
    const b = nodeId(2);
    const c = nodeId(3);
    const d = nodeId(4);

    expect(
      topologicalSort(
        graph(
          [node(a), node(d), node(c), node(b)],
          [
            { source: a, target: d },
            { source: a, target: c },
            { source: a, target: b },
          ],
        ),
      ),
    ).toEqual({
      status: "ok",
      nodeIds: [a, b, c, d],
      layers: [[a], [b, c, d]],
    });
  });
});
