import { describe, expect, it, vi } from "vitest";
import {
  GenerateCodeClientError,
  generateCode,
} from "./generate-code-client.js";

describe("generateCode client", () => {
  it("posts a TypeScript generation request and parses the bundle", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        data: generatedCodeBundle(),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateCode({
        flowId: "10000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toMatchObject({
      language: "typescript",
      entrypoint: "flow.ts",
      files: [
        {
          path: "flow.ts",
          content: "export {};",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows/10000000-0000-4000-8000-000000000001/code",
      expect.objectContaining({
        body: JSON.stringify({ language: "typescript" }),
        method: "POST",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("throws typed client errors for API error envelopes", async () => {
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

    await expect(
      generateCode({
        flowId: "10000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toMatchObject({
      code: "FLOW_NOT_EXECUTABLE",
      message: "The flow cannot be executed.",
      status: 422,
    });

    vi.unstubAllGlobals();
  });

  it("throws a typed client error for malformed success envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          data: {
            language: "typescript",
          },
        }),
      ),
    );

    await expect(
      generateCode({
        flowId: "10000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toBeInstanceOf(GenerateCodeClientError);

    vi.unstubAllGlobals();
  });
});

function generatedCodeBundle() {
  return {
    language: "typescript",
    entrypoint: "flow.ts",
    files: [
      {
        path: "flow.ts",
        content: "export {};",
      },
    ],
    warnings: [],
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
