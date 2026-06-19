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
import { RunPanel } from "./run-panel.js";

const flowId = "10000000-0000-4000-8000-000000000001";
const inputId = "10000000-0000-4000-8000-000000000101";
const templateId = "10000000-0000-4000-8000-000000000102";
const outputId = "10000000-0000-4000-8000-000000000103";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RunPanel", () => {
  it("renders runtime inputs, runs the flow, and displays outputs", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          status: "succeeded",
          startedAt: "2026-06-19T00:00:00.000Z",
          completedAt: "2026-06-19T00:00:00.012Z",
          durationMs: 12,
          outputs: {
            result: "Processed source",
          },
          nodeResults: [
            {
              nodeId: inputId,
              status: "succeeded",
              durationMs: 1,
              outputPreview: "source",
            },
            {
              nodeId: outputId,
              status: "succeeded",
              durationMs: 1,
              outputPreview: "Processed source",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRunPanel({ disabled: false });

    const input = await screen.findByLabelText("Input");
    expect((input as HTMLTextAreaElement).value).toBe("Default text");

    await user.clear(input);
    await user.type(input, "source");
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect((await screen.findAllByText("Processed source")).length).toBe(2);
    expect(screen.getByText("result")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/flows/${flowId}/run`,
      expect.objectContaining({
        body: JSON.stringify({ inputs: { input: "source" } }),
        method: "POST",
      }),
    );
  });

  it("displays API errors", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(503, {
          error: {
            code: "AI_DISABLED",
            message: "AI features are disabled.",
            requestId: "20000000-0000-4000-8000-000000000001",
          },
        }),
      ),
    );
    renderRunPanel({ disabled: false });

    await user.click(screen.getByRole("button", { name: "Run" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Run failed");
    expect(screen.getByText("AI features are disabled.")).toBeTruthy();
  });

  it("disables run while executable validation errors exist", async () => {
    renderRunPanel({ disabled: true });

    expect(
      (screen.getByRole("button", { name: "Run" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Resolve executable validation errors before running."),
    ).toBeTruthy();
  });
});

function renderRunPanel({ disabled }: { readonly disabled: boolean }) {
  render(
    <EditorStoreProvider flow={createFlowResource()}>
      <RunPanel disabled={disabled} />
    </EditorStoreProvider>,
  );
}

function createFlowResource(): FlowResource {
  return {
    id: flowId,
    name: "Run Test Flow",
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
      defaultValue: "Default text",
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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
