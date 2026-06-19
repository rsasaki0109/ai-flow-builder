// @vitest-environment jsdom

import type { FlowGraph, FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EditorStoreProvider,
  useEditorStore,
} from "../../editor/store/index.js";
import { AiGenerationDialog } from "./ai-generation-dialog.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AiGenerationDialog", () => {
  it("generates a flow and renders preview details", async () => {
    const user = userEvent.setup();
    const deferredResponse = createDeferredResponse();
    const fetchMock = vi.fn(() => deferredResponse.promise);
    vi.stubGlobal("fetch", fetchMock);
    renderDialog();

    await user.type(
      screen.getByLabelText("Prompt"),
      "入力文章をAIで要約して出力するフロー",
    );
    await user.click(screen.getByRole("button", { name: "Generate Flow" }));

    expect(await screen.findByText("Generating flow...")).toBeTruthy();
    deferredResponse.resolve(
      jsonResponse(200, {
        data: generatedFlowResponse(),
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Generated flow preview" }),
    ).toBeTruthy();
    expect(screen.getByText("Generated Summary")).toBeTruthy();
    expect(screen.getByText("A single text input is used.")).toBeTruthy();
    expect(screen.getByText("Template warning")).toBeTruthy();
    expect(screen.getByText("3 edges")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/generate-flow",
      expect.objectContaining({
        body: JSON.stringify({
          prompt: "入力文章をAIで要約して出力するフロー",
        }),
        method: "POST",
      }),
    );
  });

  it("shows an apply confirmation without mutating the editor graph", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          data: generatedFlowResponse(),
        }),
      ),
    );
    renderDialog();

    await user.type(screen.getByLabelText("Prompt"), "Build a flow");
    await user.click(screen.getByRole("button", { name: "Generate Flow" }));
    await screen.findByRole("heading", { name: "Generated flow preview" });
    await user.click(screen.getByRole("button", { name: "Review Apply" }));

    expect(
      screen.getByRole("heading", { name: "Apply generated flow?" }),
    ).toBeTruthy();
    expect(screen.getByText(/Generated Summary/)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Apply Generated Flow",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("calls the apply callback and closes the dialog when apply is enabled", async () => {
    const user = userEvent.setup();
    const onApplyDraft = vi.fn();
    const onOpenChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          data: generatedFlowResponse(),
        }),
      ),
    );
    render(
      <AiGenerationDialog
        onApplyDraft={onApplyDraft}
        onOpenChange={onOpenChange}
        open
      />,
    );

    await user.type(screen.getByLabelText("Prompt"), "Build a flow");
    await user.click(screen.getByRole("button", { name: "Generate Flow" }));
    await screen.findByRole("heading", { name: "Generated flow preview" });
    await user.click(screen.getByRole("button", { name: "Review Apply" }));
    await user.click(
      screen.getByRole("button", { name: "Apply Generated Flow" }),
    );

    expect(onApplyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Generated Summary",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("applies a generated draft through the editor store and undo restores the original graph", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          data: generatedFlowResponse(),
        }),
      ),
    );
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <AiApplyHarness />
      </EditorStoreProvider>,
    );

    expect(screen.getByTestId("node-count").textContent).toBe("1");
    expect(screen.getByTestId("save-status").textContent).toBe("saved");

    await user.type(screen.getByLabelText("Prompt"), "Build a flow");
    await user.click(screen.getByRole("button", { name: "Generate Flow" }));
    await screen.findByRole("heading", { name: "Generated flow preview" });
    await user.click(screen.getByRole("button", { name: "Review Apply" }));
    await user.click(
      screen.getByRole("button", { name: "Apply Generated Flow" }),
    );

    expect(screen.getByTestId("node-count").textContent).toBe("4");
    expect(screen.getByTestId("history-count").textContent).toBe("1");
    expect(screen.getByTestId("save-status").textContent).toBe("dirty");

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(screen.getByTestId("node-count").textContent).toBe("1");
    expect(screen.getByTestId("history-count").textContent).toBe("0");
    expect(screen.getByTestId("future-count").textContent).toBe("1");
    expect(screen.getByTestId("save-status").textContent).toBe("dirty");
  });

  it("displays API errors and returns to prompt editing", async () => {
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
    renderDialog();

    await user.type(screen.getByLabelText("Prompt"), "Build a flow");
    await user.click(screen.getByRole("button", { name: "Generate Flow" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("AI generation failed");
    expect(screen.getByText("AI features are disabled.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit Prompt" }));
    expect(screen.getByLabelText("Prompt")).toBeTruthy();
  });

  it("keeps the generate action disabled for a blank prompt", () => {
    renderDialog();

    expect(
      (
        screen.getByRole("button", {
          name: "Generate Flow",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Prompt is required.")).toBeTruthy();
  });
});

function renderDialog() {
  render(
    <AiGenerationDialog
      onOpenChange={() => {
        return undefined;
      }}
      open
    />,
  );
}

function AiApplyHarness() {
  const graph = useEditorStore((store) => store.graph);
  const futureCount = useEditorStore((store) => store.history.future.length);
  const historyCount = useEditorStore((store) => store.history.past.length);
  const replaceGraphFromAi = useEditorStore(
    (store) => store.replaceGraphFromAi,
  );
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const undo = useEditorStore((store) => store.undo);

  return (
    <div>
      <span data-testid="future-count">{futureCount}</span>
      <span data-testid="history-count">{historyCount}</span>
      <span data-testid="node-count">{graph.nodes.length}</span>
      <span data-testid="save-status">{saveStatus}</span>
      <button onClick={undo} type="button">
        Undo
      </button>
      <AiGenerationDialog
        onApplyDraft={replaceGraphFromAi}
        onOpenChange={() => {
          return undefined;
        }}
        open
      />
    </div>
  );
}

function createFlowResource(): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "AI Apply Test Flow",
    description: null,
    graph: originalGraph(),
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}

function originalGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    nodes: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        kind: "core.input.text",
        specVersion: 1,
        position: { x: 0, y: 0 },
        label: "Original Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function generatedFlowResponse() {
  return {
    draft: {
      name: "Generated Summary",
      description: "Summarizes input text.",
      graph: {
        schemaVersion: 1,
        nodes: [
          {
            id: "10000000-0000-4000-8000-000000000101",
            kind: "core.input.text",
            specVersion: 1,
            position: { x: 0, y: 0 },
            label: "Text Input",
            config: {
              key: "input",
              label: "Input",
              required: true,
            },
          },
          {
            id: "10000000-0000-4000-8000-000000000102",
            kind: "core.text.template",
            specVersion: 1,
            position: { x: 300, y: 0 },
            label: "Summary Prompt",
            config: {
              template: "Summarize:\n{{input}}",
            },
          },
          {
            id: "10000000-0000-4000-8000-000000000103",
            kind: "ai.text.generate",
            specVersion: 1,
            position: { x: 600, y: 0 },
            label: "AI Generate",
            config: {
              systemPrompt: "Be concise.",
            },
          },
          {
            id: "10000000-0000-4000-8000-000000000104",
            kind: "core.output.text",
            specVersion: 1,
            position: { x: 900, y: 0 },
            label: "Text Output",
            config: {
              key: "result",
              label: "Result",
            },
          },
        ],
        edges: [
          {
            id: "10000000-0000-4000-8000-000000000201",
            source: {
              nodeId: "10000000-0000-4000-8000-000000000101",
              portId: "value",
            },
            target: {
              nodeId: "10000000-0000-4000-8000-000000000102",
              portId: "input",
            },
          },
          {
            id: "10000000-0000-4000-8000-000000000202",
            source: {
              nodeId: "10000000-0000-4000-8000-000000000102",
              portId: "text",
            },
            target: {
              nodeId: "10000000-0000-4000-8000-000000000103",
              portId: "prompt",
            },
          },
          {
            id: "10000000-0000-4000-8000-000000000203",
            source: {
              nodeId: "10000000-0000-4000-8000-000000000103",
              portId: "text",
            },
            target: {
              nodeId: "10000000-0000-4000-8000-000000000104",
              portId: "value",
            },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    },
    assumptions: ["A single text input is used."],
    unsupportedRequirements: ["Scheduling is not available in the MVP."],
    warnings: [
      {
        severity: "warning",
        code: "NODE_LABEL_DUPLICATE",
        message: "Template warning",
      },
    ],
    meta: {
      provider: "fake",
      model: "fake-model",
      promptVersion: "generate-flow-v1",
      attempts: 1,
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

function createDeferredResponse(): {
  readonly promise: Promise<Response>;
  resolve(response: Response): void;
} {
  let resolveResponse: ((response: Response) => void) | null = null;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve(response) {
      resolveResponse?.(response);
    },
  };
}
