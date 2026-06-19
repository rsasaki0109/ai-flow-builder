import { describe, expect, it, vi } from "vitest";
import { RunFlowClientError, runFlow } from "./run-flow-client.js";

describe("runFlow client", () => {
  it("posts runtime inputs and parses a successful run result", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: {
          status: "succeeded",
          startedAt: "2026-06-19T00:00:00.000Z",
          completedAt: "2026-06-19T00:00:00.010Z",
          durationMs: 10,
          outputs: {
            result: "Processed text",
          },
          nodeResults: [
            {
              nodeId: "node-1",
              status: "succeeded",
              durationMs: 1,
              outputPreview: "Processed text",
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runFlow({
        flowId: "10000000-0000-4000-8000-000000000001",
        inputs: {
          input: "source",
        },
      }),
    ).resolves.toMatchObject({
      outputs: {
        result: "Processed text",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows/10000000-0000-4000-8000-000000000001/run",
      expect.objectContaining({
        body: JSON.stringify({ inputs: { input: "source" } }),
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
      runFlow({
        flowId: "10000000-0000-4000-8000-000000000001",
        inputs: {},
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
            status: "succeeded",
          },
        }),
      ),
    );

    await expect(
      runFlow({
        flowId: "10000000-0000-4000-8000-000000000001",
        inputs: {},
      }),
    ).rejects.toBeInstanceOf(RunFlowClientError);

    vi.unstubAllGlobals();
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
