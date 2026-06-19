// @vitest-environment jsdom

import type { FlowGraph, FlowResource } from "@ai-flow-builder/flow-core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { useEditorValidation } from "./use-editor-validation.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useEditorValidation", () => {
  it("debounces executable validation after graph changes", () => {
    vi.useFakeTimers();

    render(
      <EditorStoreProvider flow={createFlowResource(createInvalidGraph())}>
        <ValidationProbe />
      </EditorStoreProvider>,
    );

    expect(screen.getByTestId("validation-counts").textContent).toBe("1/0");

    fireEvent.click(screen.getByRole("button", { name: "Make valid" }));
    expect(screen.getByTestId("validation-counts").textContent).toBe("1/0");
    expect(screen.getByTestId("validation-pending").textContent).toBe("yes");

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByTestId("validation-counts").textContent).toBe("1/0");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("validation-counts").textContent).toBe("0/0");
    expect(screen.getByTestId("validation-pending").textContent).toBe("no");
  });
});

function ValidationProbe() {
  const replaceGraph = useEditorStore((store) => store.replaceGraph);
  const validation = useEditorValidation();

  return (
    <div>
      <span data-testid="validation-counts">
        {validation.errorCount}/{validation.warningCount}
      </span>
      <span data-testid="validation-pending">
        {validation.isValidating ? "yes" : "no"}
      </span>
      <button
        onClick={() => {
          replaceGraph(createValidGraph());
        }}
        type="button"
      >
        Make valid
      </button>
    </div>
  );
}

function createFlowResource(graph: FlowGraph): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Validation Test Flow",
    description: null,
    graph,
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function createInvalidGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function createValidGraph(): FlowGraph {
  return {
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
    edges: [
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
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
