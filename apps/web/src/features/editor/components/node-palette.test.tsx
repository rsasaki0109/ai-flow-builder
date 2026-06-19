// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { NodePalette } from "./node-palette.js";

afterEach(() => {
  cleanup();
});

describe("NodePalette", () => {
  it("renders built-in node specs grouped by category", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <NodePalette />
      </EditorStoreProvider>,
    );

    expect(screen.getByRole("heading", { name: "Input" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Transform" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "AI" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Output" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Text Input" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Text Template" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add AI Generate" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Add Text Output" }),
    ).toBeTruthy();
  });

  it("adds a node at the next palette position and selects it", async () => {
    const user = userEvent.setup();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <NodePalette />
        <GraphProbe />
      </EditorStoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add Text Input" }));
    await user.click(screen.getByRole("button", { name: "Add Text Output" }));

    expect(screen.getByTestId("node-count").textContent).toBe("2");
    expect(screen.getByTestId("node-kinds").textContent).toBe(
      "core.input.text,core.output.text",
    );
    expect(screen.getByTestId("node-positions").textContent).toBe(
      "80,80;120,80",
    );
    expect(screen.getByTestId("save-status").textContent).toBe("dirty");
    expect(screen.getByTestId("selected-kind").textContent).toBe(
      "core.output.text",
    );
  });
});

function GraphProbe() {
  const nodes = useEditorStore((store) => store.graph.nodes);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);
  const selectedKind =
    nodes.find((node) => node.id === selectedNodeId)?.kind ?? "none";

  return (
    <div>
      <span data-testid="node-count">{nodes.length}</span>
      <span data-testid="node-kinds">
        {nodes.map((node) => node.kind).join(",")}
      </span>
      <span data-testid="node-positions">
        {nodes.map((node) => `${node.position.x},${node.position.y}`).join(";")}
      </span>
      <span data-testid="save-status">{saveStatus}</span>
      <span data-testid="selected-kind">{selectedKind}</span>
    </div>
  );
}

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Palette Test Flow",
    description: "Palette test",
    graph: {
      schemaVersion: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}
