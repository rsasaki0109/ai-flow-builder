import {
  DisabledAiProvider,
  FakeAiProvider,
  type FlowPlan,
} from "@ai-flow-builder/ai";
import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "@ai-flow-builder/db";
import type { FlowResource } from "@ai-flow-builder/flow-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../../server/config.js";
import {
  createServerContainer,
  setServerContainerForTest,
} from "../../../../server/container.js";
import { GenerateFlowFromTextService } from "../../../../server/services/generate-flow-service.js";
import { POST } from "./route.js";

const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

let repository: TrackingFlowRepository;

beforeEach(() => {
  repository = new TrackingFlowRepository();
  configureRoute(new FakeAiProvider());
});

afterEach(() => {
  setServerContainerForTest(null);
});

describe("/api/ai/generate-flow route", () => {
  it("returns a generated flow draft without reading or writing the database", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "Build a text flow",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      data: {
        draft: {
          name: "Fake Text Flow",
          description: "A deterministic fake flow plan.",
          graph: {
            schemaVersion: 1,
            nodes: [
              { kind: "core.input.text" },
              { kind: "core.text.template" },
              { kind: "core.output.text" },
            ],
            edges: [{}, {}],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        },
        assumptions: ["The fake provider uses a single text input."],
        unsupportedRequirements: [],
        warnings: [],
        meta: {
          provider: "fake",
          model: "fake-model",
          promptVersion: "generate-flow-v1",
          attempts: 1,
        },
      },
    });
  });

  it("returns 400 when the request body is invalid", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        promptText: "missing prompt field",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 400 when the prompt is blank", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "   ",
      }),
    );

    expect(response.status).toBe(400);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 413 when the prompt exceeds the generation limit", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "x".repeat(4_001),
      }),
    );

    expect(response.status).toBe(413);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      error: {
        code: "PROMPT_TOO_LARGE",
        requestId: REQUEST_ID,
        details: {
          maxLength: 4_000,
        },
      },
    });
  });

  it("returns 503 when AI generation is disabled", async () => {
    configureRoute(new DisabledAiProvider(), { aiProvider: "disabled" });

    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "Build a text flow",
      }),
    );

    expect(response.status).toBe(503);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      error: {
        code: "AI_DISABLED",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 502 when the provider fails", async () => {
    configureRoute(new FakeAiProvider({ failure: "AI_RATE_LIMITED" }));

    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "Build a text flow",
      }),
    );

    expect(response.status).toBe(502);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      error: {
        code: "AI_PROVIDER_ERROR",
        message: "The AI provider is rate limited.",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 422 when generated and repaired plans remain invalid", async () => {
    configureRoute(
      new FakeAiProvider({
        structuredValue: planWithoutOutput(),
      }),
    );

    const response = await POST(
      jsonRequest("http://localhost/api/ai/generate-flow", {
        prompt: "Build a text flow",
      }),
    );

    expect(response.status).toBe(422);
    expect(repository.calls).toEqual([]);
    expect(await response.json()).toMatchObject({
      error: {
        code: "AI_GENERATED_INVALID_FLOW",
        requestId: REQUEST_ID,
      },
    });
  });
});

class TrackingFlowRepository implements FlowRepository {
  public readonly calls: string[] = [];

  public async list(options?: { limit?: number }): Promise<FlowResource[]> {
    void options;
    this.calls.push("list");
    throw new Error("AI generate route must not list flows.");
  }

  public async findById(id: string): Promise<FlowResource | null> {
    void id;
    this.calls.push("findById");
    throw new Error("AI generate route must not read flows.");
  }

  public async create(input: CreateFlowRecord): Promise<FlowResource> {
    void input;
    this.calls.push("create");
    throw new Error("AI generate route must not create flows.");
  }

  public async update(input: UpdateFlowRecord): Promise<UpdateFlowResult> {
    void input;
    this.calls.push("update");
    throw new Error("AI generate route must not update flows.");
  }

  public async delete(id: string): Promise<boolean> {
    void id;
    this.calls.push("delete");
    throw new Error("AI generate route must not delete flows.");
  }
}

function configureRoute(
  aiProvider: FakeAiProvider | DisabledAiProvider,
  options: { readonly aiProvider?: AppConfig["aiProvider"] } = {},
): void {
  const config = createConfig(options.aiProvider ?? "fake");
  setServerContainerForTest(
    createServerContainer({
      config,
      flowRepository: repository,
      aiProvider,
      generateFlowService: new GenerateFlowFromTextService({
        aiProvider,
        timeoutMs: config.aiRequestTimeoutMs,
        idFactory: createIdFactory(),
      }),
    }),
  );
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": REQUEST_ID,
    },
    body: JSON.stringify(body),
  });
}

function createConfig(aiProvider: AppConfig["aiProvider"]): AppConfig {
  return {
    nodeEnv: "test",
    databaseUrl: "file::memory:",
    aiProvider,
    aiRequestTimeoutMs: 45_000,
    flowRunTimeoutMs: 60_000,
    logLevel: "silent",
  };
}

function planWithoutOutput(): FlowPlan {
  return {
    title: "Broken Plan",
    description: "No output node.",
    assumptions: [],
    unsupportedRequirements: [],
    nodes: [
      {
        ref: "input",
        kind: "core.input.text",
        label: "Text Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
    ],
    edges: [],
  };
}

function createIdFactory(): () => string {
  let index = 1;

  return () => {
    const id = `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
    index += 1;

    return id;
  };
}
