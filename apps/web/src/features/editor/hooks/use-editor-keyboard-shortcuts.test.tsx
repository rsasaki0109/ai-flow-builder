// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { useEditorKeyboardShortcuts } from "./use-editor-keyboard-shortcuts.js";

afterEach(() => {
  cleanup();
});

describe("useEditorKeyboardShortcuts", () => {
  it("handles undo and redo keyboard shortcuts outside editable fields", async () => {
    const user = userEvent.setup();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ShortcutProbe />
      </EditorStoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add node" }));
    expect(screen.getByTestId("node-count").textContent).toBe("1");

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    expect(screen.getByTestId("node-count").textContent).toBe("0");

    fireEvent.keyDown(window, { ctrlKey: true, key: "z", shiftKey: true });
    expect(screen.getByTestId("node-count").textContent).toBe("1");

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    expect(screen.getByTestId("node-count").textContent).toBe("0");

    fireEvent.keyDown(window, { ctrlKey: true, key: "y" });
    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });

  it("does not intercept undo shortcuts from editable fields", async () => {
    const user = userEvent.setup();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ShortcutProbe />
      </EditorStoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Add node" }));
    fireEvent.keyDown(screen.getByLabelText("Draft"), {
      ctrlKey: true,
      key: "z",
    });

    expect(screen.getByTestId("node-count").textContent).toBe("1");
  });
});

function ShortcutProbe() {
  useEditorKeyboardShortcuts();

  const addNode = useEditorStore((store) => store.addNode);
  const nodeCount = useEditorStore((store) => store.graph.nodes.length);

  return (
    <div>
      <span data-testid="node-count">{nodeCount}</span>
      <button
        onClick={() => {
          addNode("core.input.text", { x: 0, y: 0 });
        }}
        type="button"
      >
        Add node
      </button>
      <input aria-label="Draft" />
    </div>
  );
}

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Shortcut Test Flow",
    description: null,
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
