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
import { EditorStoreProvider } from "../../editor/store/index.js";
import { CodePanel } from "./code-panel.js";

const flowId = "10000000-0000-4000-8000-000000000001";
const inputId = "10000000-0000-4000-8000-000000000101";
const templateId = "10000000-0000-4000-8000-000000000102";
const outputId = "10000000-0000-4000-8000-000000000103";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CodePanel", () => {
  it("generates code, displays it, copies it, and downloads flow.ts", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(value: string) => Promise<void>>(async () => {});
    const createObjectUrl = vi.fn(() => "blob:flow-ts");
    const revokeObjectUrl = vi.fn<(value: string) => void>();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: generatedCodeBundle(),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    renderCodePanel({ disabled: false });

    await user.click(screen.getByRole("button", { name: "Generate" }));

    const codeBlock = await screen.findByLabelText("Generated code");
    expect(codeBlock.textContent).toContain(
      "export async function runFlow() {}",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/flows/${flowId}/code`,
      expect.objectContaining({
        body: JSON.stringify({ language: "typescript" }),
        method: "POST",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(
      "export async function runFlow() {}",
    );
    expect(screen.getByText("Copied")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:flow-ts");
  });

  it("displays API errors", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(422, {
          error: {
            code: "FLOW_NOT_EXECUTABLE",
            message: "The flow cannot be executed.",
            requestId: "20000000-0000-4000-8000-000000000001",
          },
        }),
      ),
    );
    renderCodePanel({ disabled: false });

    await user.click(screen.getByRole("button", { name: "Generate" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The flow cannot be executed.");
  });

  it("disables generation while executable validation errors exist", () => {
    renderCodePanel({ disabled: true });

    expect(
      (screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "Resolve executable validation errors before generating code.",
      ),
    ).toBeTruthy();
  });
});

function renderCodePanel({ disabled }: { readonly disabled: boolean }) {
  render(
    <EditorStoreProvider flow={createFlowResource()}>
      <CodePanel disabled={disabled} />
    </EditorStoreProvider>,
  );
}

function createFlowResource(): FlowResource {
  return {
    id: flowId,
    name: "Code Test Flow",
    description: null,
    graph: executableGraph(),
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function executableGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [inputNode(inputId), templateNode(templateId), outputNode(outputId)],
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000201",
        inputId,
        "value",
        templateId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-000000000202",
        templateId,
        "text",
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

function templateNode(id: string): FlowNode {
  return {
    id,
    kind: "core.text.template",
    specVersion: 1,
    position: { x: 0, y: 0 },
    label: "Text Template",
    config: {
      template: "Processed {{input}}",
    },
  };
}

function outputNode(id: string): FlowNode {
  return {
    id,
    kind: "core.output.text",
    specVersion: 1,
    position: { x: 0, y: 0 },
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

function generatedCodeBundle() {
  return {
    language: "typescript",
    entrypoint: "flow.ts",
    files: [
      {
        path: "flow.ts",
        content: "export async function runFlow() {}",
      },
    ],
    warnings: [
      {
        code: "NODE_NOT_REACHING_OUTPUT",
        message: "Node is not used.",
      },
    ],
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
