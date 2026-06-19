// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Problems")).toBeTruthy();
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
