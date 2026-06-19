import { describe, expect, it, vi } from "vitest";
import {
  GenerateFlowClientError,
  generateFlowFromText,
} from "./generate-flow-client.js";

describe("generateFlowFromText client", () => {
  it("posts a prompt and parses a successful generated flow response", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: generatedFlowResponse(),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateFlowFromText({
        prompt: "Build a summary flow",
      }),
    ).resolves.toMatchObject({
      draft: {
        name: "Generated Summary",
      },
      meta: {
        provider: "fake",
        attempts: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/generate-flow",
      expect.objectContaining({
        body: JSON.stringify({ prompt: "Build a summary flow" }),
        method: "POST",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("throws typed client errors for API error envelopes", async () => {
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

    await expect(
      generateFlowFromText({
        prompt: "Build a summary flow",
      }),
    ).rejects.toMatchObject({
      code: "AI_DISABLED",
      message: "AI features are disabled.",
      status: 503,
    });

    vi.unstubAllGlobals();
  });

  it("throws a typed client error for malformed success envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          data: {
            draft: {
              name: "Missing graph",
            },
          },
        }),
      ),
    );

    await expect(
      generateFlowFromText({
        prompt: "Build a summary flow",
      }),
    ).rejects.toBeInstanceOf(GenerateFlowClientError);

    vi.unstubAllGlobals();
  });
});

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
            kind: "core.output.text",
            specVersion: 1,
            position: { x: 300, y: 0 },
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
              portId: "value",
            },
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    },
    assumptions: ["A single text input is used."],
    unsupportedRequirements: [],
    warnings: [],
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
