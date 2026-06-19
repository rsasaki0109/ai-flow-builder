// @vitest-environment jsdom

import type { FlowNode, FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { NodeInspector } from "./node-inspector.js";

afterEach(() => {
  cleanup();
});

describe("NodeInspector", () => {
  it("shows flow metadata when no node is selected", () => {
    renderInspector();

    expect(screen.getByRole("heading", { name: "Inspector" })).toBeTruthy();
    expect(
      screen.getByText("Select a node to edit its settings."),
    ).toBeTruthy();
    expect(screen.getByText("Inspector test flow")).toBeTruthy();
    expect(
      screen.getByText("10000000-0000-4000-8000-000000000001"),
    ).toBeTruthy();
  });

  it("renders dedicated settings for all built-in node kinds", async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole("button", { name: "Select Text Input" }));
    expect(
      screen.getByRole("heading", { name: "Text Input settings" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Input key")).toBeTruthy();
    expect(screen.getByLabelText("Input label")).toBeTruthy();
    expect(screen.getByLabelText("Input required")).toBeTruthy();
    expect(screen.getByLabelText("Input default value")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Select Text Template" }),
    );
    expect(
      screen.getByRole("heading", { name: "Text Template settings" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Template")).toBeTruthy();
    expect(screen.getByText("Available placeholder: {{input}}")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Select AI Generate" }),
    );
    expect(
      screen.getByRole("heading", { name: "AI Generate settings" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("System prompt")).toBeTruthy();
    expect(screen.getByText("Provider and model")).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: "Select Text Output" }),
    );
    expect(
      screen.getByRole("heading", { name: "Text Output settings" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Output key")).toBeTruthy();
    expect(screen.getByLabelText("Output label")).toBeTruthy();
  });

  it("commits valid text input settings and rejects invalid keys", async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(screen.getByRole("button", { name: "Select Text Input" }));

    await replaceFieldValue(user, "Input key", "topic");
    expect(screen.getByTestId("input-config").textContent).toContain(
      '"key":"topic"',
    );
    expect(screen.getByTestId("save-status").textContent).toBe("dirty");

    await replaceFieldValue(user, "Input key", "1bad");
    expect(
      screen.getByText(
        "Key must start with a letter or underscore and contain only letters, numbers, and underscores.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("input-config").textContent).toContain(
      '"key":"topic"',
    );
  });

  it("commits template, AI, and output settings on blur", async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(
      screen.getByRole("button", { name: "Select Text Template" }),
    );
    await replaceFieldValue(user, "Template", "Summarize:\\n{{input}}");
    expect(screen.getByTestId("template-config").textContent).toContain(
      '"template":"Summarize:\\\\n{{input}}"',
    );

    await user.click(
      screen.getByRole("button", { name: "Select AI Generate" }),
    );
    await replaceFieldValue(user, "System prompt", "Use concise language.");
    expect(screen.getByTestId("ai-config").textContent).toContain(
      '"systemPrompt":"Use concise language."',
    );

    await user.click(
      screen.getByRole("button", { name: "Select Text Output" }),
    );
    await replaceFieldValue(user, "Output key", "summary");
    await replaceFieldValue(user, "Output label", "Summary");
    expect(screen.getByTestId("output-config").textContent).toContain(
      '"key":"summary"',
    );
    expect(screen.getByTestId("output-config").textContent).toContain(
      '"label":"Summary"',
    );
  });

  it("updates the common node label and deletes the selected node", async () => {
    const user = userEvent.setup();
    renderInspector();

    await user.click(
      screen.getByRole("button", { name: "Select Text Template" }),
    );
    await replaceFieldValue(user, "Node label", "Prompt Builder");
    expect(screen.getByTestId("template-label").textContent).toBe(
      "Prompt Builder",
    );

    await replaceFieldValue(user, "Node label", "");
    expect(
      screen.getByText("Node label must be 1 to 80 characters."),
    ).toBeTruthy();
    expect(screen.getByTestId("template-label").textContent).toBe(
      "Prompt Builder",
    );

    await user.click(screen.getByRole("button", { name: "Delete Node" }));
    expect(screen.getByTestId("node-count").textContent).toBe("3");
    expect(screen.getByTestId("selected-node").textContent).toBe("none");
  });
});

async function replaceFieldValue(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  const field = screen.getByLabelText(label);

  await user.click(field);
  await user.clear(field);
  if (value.length > 0) {
    await user.paste(value);
  }
  await user.tab();
}

function renderInspector() {
  render(
    <EditorStoreProvider flow={createFlowResource()}>
      <SelectionButtons />
      <NodeInspector />
      <GraphProbe />
    </EditorStoreProvider>,
  );
}

function SelectionButtons() {
  const nodes = useEditorStore((store) => store.graph.nodes);
  const selectNode = useEditorStore((store) => store.selectNode);

  return (
    <div>
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => {
            selectNode(node.id);
          }}
          type="button"
        >
          Select {node.label}
        </button>
      ))}
    </div>
  );
}

function GraphProbe() {
  const graph = useEditorStore((store) => store.graph);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const selectedNodeId = useEditorStore((store) => store.selectedNodeId);
  const inputNode = graph.nodes.find((node) => node.kind === "core.input.text");
  const templateNode = graph.nodes.find(
    (node) => node.kind === "core.text.template",
  );
  const aiNode = graph.nodes.find((node) => node.kind === "ai.text.generate");
  const outputNode = graph.nodes.find(
    (node) => node.kind === "core.output.text",
  );

  return (
    <div>
      <span data-testid="ai-config">{stringifyNodeConfig(aiNode)}</span>
      <span data-testid="input-config">{stringifyNodeConfig(inputNode)}</span>
      <span data-testid="node-count">{graph.nodes.length}</span>
      <span data-testid="output-config">{stringifyNodeConfig(outputNode)}</span>
      <span data-testid="save-status">{saveStatus}</span>
      <span data-testid="selected-node">{selectedNodeId ?? "none"}</span>
      <span data-testid="template-config">
        {stringifyNodeConfig(templateNode)}
      </span>
      <span data-testid="template-label">{templateNode?.label ?? "none"}</span>
    </div>
  );
}

function stringifyNodeConfig(node: FlowNode | undefined): string {
  return JSON.stringify(node?.config ?? null);
}

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Inspector Test Flow",
    description: "Inspector test flow",
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
            template: "{{input}}",
          },
          id: "10000000-0000-4000-8000-000000000102",
          kind: "core.text.template",
          label: "Text Template",
          position: { x: 300, y: 0 },
          specVersion: 1,
        },
        {
          config: {},
          id: "10000000-0000-4000-8000-000000000103",
          kind: "ai.text.generate",
          label: "AI Generate",
          position: { x: 600, y: 0 },
          specVersion: 1,
        },
        {
          config: {
            key: "result",
            label: "Result",
          },
          id: "10000000-0000-4000-8000-000000000104",
          kind: "core.output.text",
          label: "Text Output",
          position: { x: 900, y: 0 },
          specVersion: 1,
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}
