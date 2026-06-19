"use client";

import {
  Background,
  type Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  toReactFlowEdges,
  toReactFlowNodes,
  type ReactFlowEdgeChange,
  type ReactFlowEdge,
  type ReactFlowNodeChange,
  type ReactFlowNode,
} from "../adapters/index.js";
import { flowNodeTypes } from "../nodes/index.js";
import { useEditorStore } from "../store/index.js";
import { validateConnection } from "../validation/index.js";

export function FlowCanvas() {
  const graph = useEditorStore((store) => store.graph);
  const selectedEdgeId = useEditorStore((store) => store.selectedEdgeId);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);
  const beginNodeDrag = useEditorStore((store) => store.beginNodeDrag);
  const selectEdge = useEditorStore((store) => store.selectEdge);
  const selectNode = useEditorStore((store) => store.selectNode);
  const clearSelection = useEditorStore((store) => store.clearSelection);
  const connect = useEditorStore((store) => store.connect);
  const endNodeDrag = useEditorStore((store) => store.endNodeDrag);
  const moveNode = useEditorStore((store) => store.moveNode);
  const removeEdges = useEditorStore((store) => store.removeEdges);
  const removeNodes = useEditorStore((store) => store.removeNodes);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null,
  );

  const nodes = useMemo(
    () =>
      toReactFlowNodes(graph).map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [graph, selectedNodeId],
  );
  const edges = useMemo(
    () =>
      toReactFlowEdges(graph).map((edge) => ({
        ...edge,
        selected: edge.id === selectedEdgeId,
      })),
    [graph, selectedEdgeId],
  );
  const handleNodesChange = useCallback(
    (changes: ReactFlowNodeChange[]) => {
      const removedNodeIds: string[] = [];

      for (const change of changes) {
        if (change.type === "position" && change.position !== undefined) {
          moveNode(change.id, change.position);
        }

        if (change.type === "remove") {
          removedNodeIds.push(change.id);
        }
      }

      if (removedNodeIds.length > 0) {
        removeNodes(removedNodeIds);
      }
    },
    [moveNode, removeNodes],
  );
  const handleEdgesChange = useCallback(
    (changes: ReactFlowEdgeChange[]) => {
      const removedEdgeIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);

      if (removedEdgeIds.length > 0) {
        removeEdges(removedEdgeIds);
      }
    },
    [removeEdges],
  );
  const handleConnect = useCallback(
    (connection: Connection) => {
      const result = validateConnection(graph, {
        source: {
          nodeId: connection.source,
          portId: connection.sourceHandle,
        },
        target: {
          nodeId: connection.target,
          portId: connection.targetHandle,
        },
      });

      if (result.status === "invalid") {
        setConnectionMessage(result.message);
        return;
      }

      connect(result.source, result.target);
      setConnectionMessage(null);
    },
    [connect, graph],
  );

  useDeleteSelectionShortcut({
    removeEdges,
    removeNodes,
    selectedEdgeId,
    selectedNodeId,
  });

  return (
    <div
      className="relative h-full min-h-[360px] bg-white"
      data-testid="flow-canvas"
    >
      <ReactFlowProvider>
        <ReactFlow<ReactFlowNode, ReactFlowEdge>
          edges={edges}
          elementsSelectable
          fitView
          maxZoom={4}
          minZoom={0.1}
          nodeTypes={flowNodeTypes}
          nodes={nodes}
          deleteKeyCode={null}
          nodesConnectable
          nodesDraggable
          onConnect={handleConnect}
          onEdgesChange={handleEdgesChange}
          onEdgeClick={(_event, edge) => {
            selectEdge(edge.id);
          }}
          onNodesChange={handleNodesChange}
          onNodeClick={(_event, node) => {
            selectNode(node.id);
          }}
          onNodeDragStart={() => {
            beginNodeDrag();
          }}
          onNodeDragStop={() => {
            endNodeDrag();
          }}
          onPaneClick={() => {
            clearSelection();
          }}
        >
          <Background color="#d9dee8" gap={24} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)] shadow-sm">
        {nodes.length} nodes · {edges.length} edges
      </div>
      {connectionMessage !== null ? (
        <div
          className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[320px] rounded-md border border-[#f97316] bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412] shadow-sm"
          role="status"
        >
          {connectionMessage}
        </div>
      ) : null}
    </div>
  );
}

interface DeleteSelectionShortcutOptions {
  removeEdges: (edgeIds: readonly string[]) => void;
  removeNodes: (nodeIds: readonly string[]) => void;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
}

function useDeleteSelectionShortcut({
  removeEdges,
  removeNodes,
  selectedEdgeId,
  selectedNodeId,
}: DeleteSelectionShortcutOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") {
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (selectedNodeId !== null) {
        event.preventDefault();
        removeNodes([selectedNodeId]);
        return;
      }

      if (selectedEdgeId !== null) {
        event.preventDefault();
        removeEdges([selectedEdgeId]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [removeEdges, removeNodes, selectedEdgeId, selectedNodeId]);
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();

  return tagName === "input" || tagName === "textarea" || tagName === "select";
}
