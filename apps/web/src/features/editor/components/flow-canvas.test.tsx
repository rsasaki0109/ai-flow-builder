// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import type { Connection } from "@xyflow/react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ReactFlowEdge,
  ReactFlowEdgeChange,
  ReactFlowNode,
  ReactFlowNodeChange,
} from "../adapters/index.js";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { FlowCanvas } from "./flow-canvas.js";

interface MockReactFlowProps {
  children: ReactNode;
  deleteKeyCode?: string | string[] | null;
  edges: ReactFlowEdge[];
  nodeTypes?: Record<string, unknown>;
  nodes: ReactFlowNode[];
  nodesConnectable?: boolean;
  nodesDraggable?: boolean;
  onConnect?: (connection: Connection) => void;
  onEdgeClick?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    edge: ReactFlowEdge,
  ) => void;
  onEdgesChange?: (changes: ReactFlowEdgeChange[]) => void;
  onNodeClick?: (
    event: ReactMouseEvent<HTMLButtonElement>,
    node: ReactFlowNode,
  ) => void;
  onNodeDragStart?: () => void;
  onNodeDragStop?: () => void;
  onNodesChange?: (changes: ReactFlowNodeChange[]) => void;
  onPaneClick?: () => void;
}

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="rf-background" />,
  Controls: ({ showInteractive }: { showInteractive?: boolean }) => (
    <div
      data-show-interactive={String(showInteractive)}
      data-testid="rf-controls"
    />
  ),
  MiniMap: ({
    pannable,
    zoomable,
  }: {
    pannable?: boolean;
    zoomable?: boolean;
  }) => (
    <div
      data-pannable={String(pannable)}
      data-testid="rf-minimap"
      data-zoomable={String(zoomable)}
    />
  ),
  ReactFlow: ({
    children,
    deleteKeyCode,
    edges,
    nodeTypes,
    nodes,
    nodesConnectable,
    nodesDraggable,
    onConnect,
    onEdgeClick,
    onEdgesChange,
    onNodeClick,
    onNodeDragStart,
    onNodeDragStop,
    onNodesChange,
    onPaneClick,
  }: MockReactFlowProps) => {
    const firstEdge = edges[0];
    const firstNode = nodes[0];

    return (
      <section
        data-delete-key-code={String(deleteKeyCode)}
        data-edge-count={edges.length}
        data-node-count={nodes.length}
        data-node-types={Object.keys(nodeTypes ?? {})
          .sort()
          .join(",")}
        data-nodes-connectable={String(nodesConnectable)}
        data-nodes-draggable={String(nodesDraggable)}
        data-testid="react-flow"
      >
        <button
          disabled={firstNode === undefined}
          onClick={(event) => {
            if (firstNode !== undefined) {
              onNodeClick?.(event, firstNode);
            }
          }}
          type="button"
        >
          Select first node
        </button>
        <button
          disabled={firstEdge === undefined}
          onClick={(event) => {
            if (firstEdge !== undefined) {
              onEdgeClick?.(event, firstEdge);
            }
          }}
          type="button"
        >
          Select first edge
        </button>
        <button
          disabled={firstNode === undefined}
          onClick={() => {
            if (firstNode !== undefined) {
              onNodesChange?.([
                {
                  id: firstNode.id,
                  position: { x: 120, y: 140 },
                  type: "position",
                },
              ]);
            }
          }}
          type="button"
        >
          Move first node
        </button>
        <button
          disabled={firstNode === undefined}
          onClick={onNodeDragStart}
          type="button"
        >
          Start first node drag
        </button>
        <button
          disabled={firstNode === undefined}
          onClick={onNodeDragStop}
          type="button"
        >
          Stop first node drag
        </button>
        <button
          disabled={firstEdge === undefined}
          onClick={() => {
            if (firstEdge !== undefined) {
              onEdgesChange?.([
                {
                  id: firstEdge.id,
                  type: "remove",
                },
              ]);
            }
          }}
          type="button"
        >
          Remove first edge
        </button>
        <button
          disabled={firstNode === undefined || nodes[1] === undefined}
          onClick={() => {
            const secondNode = nodes[1];
            if (firstNode !== undefined && secondNode !== undefined) {
              onConnect?.({
                source: firstNode.id,
                sourceHandle: "value",
                target: secondNode.id,
                targetHandle: "value",
              });
            }
          }}
          type="button"
        >
          Connect first to second
        </button>
        <button onClick={onPaneClick} type="button">
          Clear selection
        </button>
        {children}
      </section>
    );
  },
  ReactFlowProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="rf-provider">{children}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("FlowCanvas", () => {
  it("passes persisted FlowGraph nodes and edges to React Flow", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
      </EditorStoreProvider>,
    );

    const reactFlow = screen.getByTestId("react-flow");
    expect(reactFlow.getAttribute("data-node-count")).toBe("2");
    expect(reactFlow.getAttribute("data-edge-count")).toBe("1");
    expect(reactFlow.getAttribute("data-nodes-connectable")).toBe("true");
    expect(reactFlow.getAttribute("data-nodes-draggable")).toBe("true");
    expect(reactFlow.getAttribute("data-delete-key-code")).toBe("null");
    expect(reactFlow.getAttribute("data-node-types")).toBe(
      [
        "ai.text.generate",
        "core.input.text",
        "core.output.text",
        "core.text.template",
      ].join(","),
    );
    expect(screen.getByText("2 nodes · 1 edges")).toBeTruthy();
    expect(screen.getByTestId("rf-background")).toBeTruthy();
    expect(screen.getByTestId("rf-controls")).toBeTruthy();
    expect(screen.getByTestId("rf-minimap")).toBeTruthy();
  });

  it("updates editor selection from canvas interactions", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
        <SelectionProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select first node" }));
    expect(screen.getByTestId("selected-node").textContent).toBe(
      "10000000-0000-4000-8000-000000000101",
    );
    expect(screen.getByTestId("selected-edge").textContent).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Select first edge" }));
    expect(screen.getByTestId("selected-node").textContent).toBe("none");
    expect(screen.getByTestId("selected-edge").textContent).toBe(
      "10000000-0000-4000-8000-000000000301",
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByTestId("selected-node").textContent).toBe("none");
    expect(screen.getByTestId("selected-edge").textContent).toBe("none");
  });

  it("moves and removes graph elements from React Flow change events", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move first node" }));
    expect(screen.getByTestId("first-node-position").textContent).toBe(
      "120,140",
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove first edge" }));
    expect(screen.getByTestId("edge-count").textContent).toBe("0");
  });

  it("coalesces node drag movement into one undo history entry", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
        <GraphProbe />
        <HistoryProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Start first node drag" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move first node" }));
    expect(screen.getByTestId("first-node-position").textContent).toBe(
      "120,140",
    );
    expect(screen.getByTestId("history-past-count").textContent).toBe("0");

    fireEvent.click(
      screen.getByRole("button", { name: "Stop first node drag" }),
    );
    expect(screen.getByTestId("history-past-count").textContent).toBe("1");
  });

  it("deletes the selected node with the keyboard outside form fields", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
        <input aria-label="Template draft" />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select first node" }));
    fireEvent.keyDown(screen.getByLabelText("Template draft"), {
      key: "Delete",
    });
    expect(screen.getByTestId("node-count").textContent).toBe("2");

    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.getByTestId("node-count").textContent).toBe("1");
    expect(screen.getByTestId("edge-count").textContent).toBe("0");
  });

  it("deletes the selected edge with the keyboard", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <FlowCanvas />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select first edge" }));
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(screen.getByTestId("node-count").textContent).toBe("2");
    expect(screen.getByTestId("edge-count").textContent).toBe("0");
  });

  it("adds valid connections and rejects invalid connections with a canvas message", () => {
    render(
      <EditorStoreProvider flow={createFlowResource({ includeEdge: false })}>
        <FlowCanvas />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Connect first to second" }),
    );
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
    expect(screen.queryByRole("status")).toBeNull();

    cleanup();

    render(
      <EditorStoreProvider flow={createFlowResource({ includeEdge: true })}>
        <FlowCanvas />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Connect first to second" }),
    );
    expect(screen.getByTestId("edge-count").textContent).toBe("1");
    expect(screen.getByRole("status").textContent).toBe(
      "This connection already exists.",
    );
  });
});

function SelectionProbe() {
  const selectedEdgeId = useEditorStore((store) => store.selectedEdgeId);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);

  return (
    <div>
      <span data-testid="selected-node">{selectedNodeId ?? "none"}</span>
      <span data-testid="selected-edge">{selectedEdgeId ?? "none"}</span>
    </div>
  );
}

function GraphProbe() {
  const edgeCount = useEditorStore((store) => store.graph.edges.length);
  const firstNodePosition = useEditorStore((store) => {
    const firstNode = store.graph.nodes[0];

    return firstNode === undefined
      ? "none"
      : `${firstNode.position.x},${firstNode.position.y}`;
  });
  const nodeCount = useEditorStore((store) => store.graph.nodes.length);

  return (
    <div>
      <span data-testid="edge-count">{edgeCount}</span>
      <span data-testid="first-node-position">{firstNodePosition}</span>
      <span data-testid="node-count">{nodeCount}</span>
    </div>
  );
}

function HistoryProbe() {
  const pastCount = useEditorStore((store) => store.history.past.length);

  return <span data-testid="history-past-count">{pastCount}</span>;
}

function createFlowResource({
  includeEdge = true,
}: {
  includeEdge?: boolean;
} = {}): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Canvas Test Flow",
    description: "Canvas render test",
    graph: {
      schemaVersion: 1,
      nodes: [
        {
          config: {
            key: "input",
            label: "Input",
            required: true,
          },
          id: "10000000-0000-4000-8000-000000000101",
          kind: "core.input.text",
          label: "Text Input",
          position: { x: 0, y: 0 },
          specVersion: 1,
        },
        {
          config: {
            key: "result",
            label: "Result",
          },
          id: "10000000-0000-4000-8000-000000000102",
          kind: "core.output.text",
          label: "Text Output",
          position: { x: 300, y: 0 },
          specVersion: 1,
        },
      ],
      edges: includeEdge
        ? [
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
          ]
        : [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}
