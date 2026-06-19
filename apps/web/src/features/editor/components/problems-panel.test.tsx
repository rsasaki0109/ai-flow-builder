// @vitest-environment jsdom

import type { FlowResource, ValidationIssue } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { ProblemsPanel } from "./problems-panel.js";

afterEach(() => {
  cleanup();
});

describe("ProblemsPanel", () => {
  it("shows an empty validation state", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ProblemsPanel isValidating={false} issues={[]} />
      </EditorStoreProvider>,
    );

    expect(screen.getByText("0 errors · 0 warnings")).toBeTruthy();
    expect(screen.getByText("Valid")).toBeTruthy();
    expect(screen.getByText("No problems found.")).toBeTruthy();
  });

  it("selects nodes and edges from targetable issues", async () => {
    const user = userEvent.setup();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ProblemsPanel isValidating issues={createIssues()} />
        <SelectionProbe />
      </EditorStoreProvider>,
    );

    expect(screen.getByText("1 errors · 1 warnings · Updating")).toBeTruthy();
    expect(screen.getByText("1 error")).toBeTruthy();

    await user.click(
      screen.getByRole("button", {
        name: /REQUIRED_INPUT_NOT_CONNECTED/,
      }),
    );
    expect(screen.getByTestId("selected-node").textContent).toBe(
      "10000000-0000-4000-8000-000000000102",
    );
    expect(screen.getByTestId("selected-edge").textContent).toBe("none");

    await user.click(
      screen.getByRole("button", {
        name: /EDGE_PORT_TYPE_MISMATCH/,
      }),
    );
    expect(screen.getByTestId("selected-node").textContent).toBe("none");
    expect(screen.getByTestId("selected-edge").textContent).toBe(
      "10000000-0000-4000-8000-000000000301",
    );
  });
});

function SelectionProbe() {
  const selectedEdgeId = useEditorStore((store) => store.selectedEdgeId);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);

  return (
    <div>
      <span data-testid="selected-edge">{selectedEdgeId ?? "none"}</span>
      <span data-testid="selected-node">{selectedNodeId ?? "none"}</span>
    </div>
  );
}

function createIssues(): ValidationIssue[] {
  return [
    {
      code: "REQUIRED_INPUT_NOT_CONNECTED",
      message:
        'Required input port "value" on node "Text Output" is not connected.',
      nodeId: "10000000-0000-4000-8000-000000000102",
      path: "nodes.1",
      severity: "error",
    },
    {
      code: "EDGE_PORT_TYPE_MISMATCH",
      edgeId: "10000000-0000-4000-8000-000000000301",
      message: "Cannot connect number output to text input.",
      path: "edges.0",
      severity: "warning",
    },
  ];
}

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Problems Test Flow",
    description: null,
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
    },
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}
