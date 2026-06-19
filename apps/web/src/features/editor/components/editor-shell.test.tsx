// @vitest-environment jsdom

import type {
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowResource,
} from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorShell } from "./editor-shell.js";

vi.mock("./flow-canvas.js", () => ({
  FlowCanvas: () => <div>Canvas shell</div>,
}));

afterEach(() => {
  cleanup();
});

describe("EditorShell", () => {
  it("renders the editor route shell with flow metadata", () => {
    render(<EditorShell flow={createFlowResource()} />);

    expect(
      screen.getByRole("link", { name: "Back" }).getAttribute("href"),
    ).toBe("/");
    expect(screen.getByRole("heading", { name: "Test Flow" })).toBeTruthy();
    expect(screen.getByText("Node Palette")).toBeTruthy();
    expect(screen.getByText("Canvas shell")).toBeTruthy();
    expect(screen.getByText("Inspector")).toBeTruthy();
    expect(screen.getAllByText("Problems").length).toBeGreaterThan(0);
  });

  it("opens the AI generation dialog from the top bar", async () => {
    const user = userEvent.setup();
    render(<EditorShell flow={createFlowResource()} />);

    await user.click(screen.getByRole("button", { name: "Generate with AI" }));

    expect(
      screen.getByRole("dialog", { name: "Generate with AI" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Prompt")).toBeTruthy();
  });

  it("opens the Code panel from the top bar for executable flows", async () => {
    const user = userEvent.setup();
    render(<EditorShell flow={createExecutableFlowResource()} />);

    const generateCodeButton = screen.getByRole("button", {
      name: "Generate Code",
    }) as HTMLButtonElement;
    expect(generateCodeButton.disabled).toBe(false);

    await user.click(generateCodeButton);

    expect(screen.getByRole("heading", { name: "Code" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate" })).toBeTruthy();
  });
});

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Test Flow",
    description: "A flow shell test",
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

function createExecutableFlowResource(): FlowResource {
  return {
    ...createFlowResource(),
    graph: executableGraph(),
  };
}

function executableGraph(): FlowGraph {
  const inputId = "10000000-0000-4000-8000-000000000101";
  const outputId = "10000000-0000-4000-8000-000000000102";

  return {
    schemaVersion: 1,
    nodes: [inputNode(inputId), outputNode(outputId)],
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000201",
        inputId,
        "value",
        outputId,
        "value",
      ),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function inputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.input.text",
    specVersion: 1,
    position: { x: 0, y: 0 },
    label: "Text Input",
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
  };
}

function outputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.output.text",
    specVersion: 1,
    position: { x: 300, y: 0 },
    label: "Text Output",
    config: {
      key: "result",
      label: "Result",
    },
  };
}

function edge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): FlowEdge {
  return {
    id,
    source: {
      nodeId: sourceNodeId,
      portId: sourcePortId,
    },
    target: {
      nodeId: targetNodeId,
      portId: targetPortId,
    },
  };
}
