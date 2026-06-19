import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "@ai-flow-builder/db";
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { MAX_NODE_OUTPUT_TEXT_LENGTH } from "@ai-flow-builder/flow-engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../../../server/config.js";
import {
  createServerContainer,
  setServerContainerForTest,
} from "../../../../../server/container.js";
import { POST } from "./route.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const MISSING_FLOW_ID = "10000000-0000-4000-8000-000000000999";
const REQUEST_ID = "20000000-0000-4000-8000-000000000001";
const inputId = "10000000-0000-4000-8000-000000000101";
const templateId = "10000000-0000-4000-8000-000000000102";
const aiId = "10000000-0000-4000-8000-000000000103";
const outputId = "10000000-0000-4000-8000-000000000104";

let repository: InMemoryFlowRepository;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
  setServerContainerForTest(
    createServerContainer({
      config: createConfig({ aiProvider: "fake" }),
      flowRepository: repository,
    }),
  );
});

afterEach(() => {
  setServerContainerForTest(null);
});

describe("/api/flows/[flowId]/run route", () => {
  it("runs an executable flow and returns a run result", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });

    const response = await POST(
      routeRequest(`http://localhost/api/flows/${FLOW_ID}/run`, {
        inputs: {
          input: "source",
        },
      }),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(await response.json()).toMatchObject({
      data: {
        status: "succeeded",
        outputs: {
          result: "Processed: source",
        },
      },
    });
  });

  it("returns 404 when the flow does not exist", async () => {
    const response = await POST(
      routeRequest(`http://localhost/api/flows/${MISSING_FLOW_ID}/run`, {
        inputs: {},
      }),
      routeContext(MISSING_FLOW_ID),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: {
        code: "FLOW_NOT_FOUND",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 422 when the flow is not executable", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Empty Flow",
      description: null,
      graph: emptyGraph(),
    });

    const response = await POST(
      routeRequest(`http://localhost/api/flows/${FLOW_ID}/run`, {
        inputs: {},
      }),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "FLOW_NOT_EXECUTABLE",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 503 when an AI node runs while AI is disabled", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "AI Flow",
      description: null,
      graph: aiGraph(),
    });
    setServerContainerForTest(
      createServerContainer({
        config: createConfig({ aiProvider: "disabled" }),
        flowRepository: repository,
      }),
    );

    const response = await POST(
      routeRequest(`http://localhost/api/flows/${FLOW_ID}/run`, {
        inputs: {
          input: "source",
        },
      }),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "AI_DISABLED",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 400 when a runtime input exceeds the per-item limit", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Template Flow",
      description: null,
      graph: templateGraph(),
    });

    const response = await POST(
      routeRequest(`http://localhost/api/flows/${FLOW_ID}/run`, {
        inputs: {
          input: "x".repeat(50_001),
        },
      }),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 400 when execution produces an oversized node output", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Amplifying Template Flow",
      description: null,
      graph: amplifyingTemplateGraph(),
    });
    const oversizedInput = "x".repeat(50_000);

    const response = await POST(
      routeRequest(`http://localhost/api/flows/${FLOW_ID}/run`, {
        inputs: {
          input: oversizedInput,
        },
      }),
      routeContext(FLOW_ID),
    );

    const bodyText = await response.text();
    expect(response.status).toBe(400);
    expect(bodyText).not.toContain(oversizedInput);
    expect(JSON.parse(bodyText)).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId: REQUEST_ID,
        details: {
          maxLength: MAX_NODE_OUTPUT_TEXT_LENGTH,
          nodeId: templateId,
          outputKey: "text",
        },
      },
    });
  });
});

class InMemoryFlowRepository implements FlowRepository {
  private readonly records = new Map<string, FlowResource>();

  public async list(): Promise<FlowResource[]> {
    return [...this.records.values()];
  }

  public async findById(id: string): Promise<FlowResource | null> {
    return this.records.get(id) ?? null;
  }

  public async create(input: CreateFlowRecord): Promise<FlowResource> {
    const flow = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: 1,
    });
    this.records.set(flow.id, flow);

    return flow;
  }

  public async update(input: UpdateFlowRecord): Promise<UpdateFlowResult> {
    const current = this.records.get(input.id);
    if (current === undefined) {
      return { status: "not_found" };
    }

    const flow = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: current.revision + 1,
    });
    this.records.set(flow.id, flow);

    return { status: "updated", flow };
  }

  public async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

function routeContext(flowId: string): { params: Promise<{ flowId: string }> } {
  return { params: Promise.resolve({ flowId }) };
}

function routeRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": REQUEST_ID,
    },
    body: JSON.stringify(body),
  });
}

function createConfig(input: {
  readonly aiProvider: AppConfig["aiProvider"];
}): AppConfig {
  return {
    nodeEnv: "test",
    databaseUrl: "file::memory:",
    aiProvider: input.aiProvider,
    aiRequestTimeoutMs: 45_000,
    flowRunTimeoutMs: 60_000,
    logLevel: "silent",
  };
}

function templateGraph(): FlowGraph {
  return graph({
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
    nodes: [
      inputNode(inputId),
      templateNode(templateId, "Processed: {{input}}"),
      outputNode(outputId),
    ],
  });
}

function amplifyingTemplateGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000501",
        inputId,
        "value",
        templateId,
        "input",
      ),
      edge(
        "10000000-0000-4000-8000-000000000502",
        templateId,
        "text",
        outputId,
        "value",
      ),
    ],
    nodes: [
      inputNode(inputId),
      templateNode(templateId, "{{input}}{{input}}{{input}}"),
      outputNode(outputId),
    ],
  });
}

function aiGraph(): FlowGraph {
  return graph({
    edges: [
      edge(
        "10000000-0000-4000-8000-000000000301",
        inputId,
        "value",
        aiId,
        "prompt",
      ),
      edge(
        "10000000-0000-4000-8000-000000000302",
        aiId,
        "text",
        outputId,
        "value",
      ),
    ],
    nodes: [inputNode(inputId), aiNode(aiId), outputNode(outputId)],
  });
}

function emptyGraph(): FlowGraph {
  return graph({ edges: [], nodes: [] });
}

function graph(input: {
  readonly nodes: readonly FlowNode[];
  readonly edges: readonly FlowEdge[];
}): FlowGraph {
  return {
    edges: [...input.edges],
    nodes: [...input.nodes],
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function inputNode(id: string): FlowNode {
  return {
    config: {
      key: "input",
      label: "Input",
      required: true,
    },
    id,
    kind: "core.input.text",
    label: "Text Input",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function templateNode(id: string, template: string): FlowNode {
  return {
    config: {
      template,
    },
    id,
    kind: "core.text.template",
    label: "Text Template",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function aiNode(id: string): FlowNode {
  return {
    config: {},
    id,
    kind: "ai.text.generate",
    label: "AI Generate",
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}

function outputNode(id: string): FlowNode {
  return {
    config: {
      key: "result",
      label: "Result",
    },
    id,
    kind: "core.output.text",
    label: "Text Output",
    position: { x: 0, y: 0 },
    specVersion: 1,
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

function createResource(input: {
  id: string;
  name: string;
  description: string | null;
  graph: FlowGraph;
  revision: number;
}): FlowResource {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    graph: input.graph,
    revision: input.revision,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
  };
}
