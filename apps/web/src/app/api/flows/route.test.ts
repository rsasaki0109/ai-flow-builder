import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "@ai-flow-builder/db";
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  MAX_TEMPLATE_LENGTH,
  type FlowGraph,
  type FlowNode,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../server/config.js";
import {
  createServerContainer,
  setServerContainerForTest,
} from "../../../server/container.js";
import { FlowService } from "../../../server/services/flow-service.js";
import { GET, POST } from "./route.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

let repository: InMemoryFlowRepository;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
  setServerContainerForTest(
    createServerContainer({
      config: createConfig(),
      flowRepository: repository,
      flowService: new FlowService(repository, { createId: () => FLOW_ID }),
    }),
  );
});

afterEach(() => {
  setServerContainerForTest(null);
});

describe("/api/flows route", () => {
  it("creates a flow and returns 201", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/flows", {
        name: "Created Flow",
        description: null,
        graph: createEmptyGraph(),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(await response.json()).toMatchObject({
      data: {
        id: FLOW_ID,
        name: "Created Flow",
        description: null,
        revision: 1,
        graph: createEmptyGraph(),
      },
    });
  });

  it("lists flow summaries without graph documents", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Listed Flow",
      description: "Summary only",
      graph: createEmptyGraph(),
    });

    const response = await GET(
      new Request("http://localhost/api/flows?limit=25", {
        headers: { "x-request-id": REQUEST_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(repository.lastListOptions).toEqual({ limit: 25 });
    expect(await response.json()).toEqual({
      data: {
        items: [
          {
            id: FLOW_ID,
            name: "Listed Flow",
            description: "Summary only",
            revision: 1,
            createdAt: "2026-06-18T00:00:00.000Z",
            updatedAt: "2026-06-18T00:00:00.000Z",
          },
        ],
      },
    });
  });

  it("returns 422 when the flow graph is invalid", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/flows", {
        name: "Invalid Flow",
        description: null,
        graph: {
          ...createEmptyGraph(),
          viewport: { x: 0, y: 0, zoom: 99 },
        },
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_FLOW_DOCUMENT",
        requestId: REQUEST_ID,
      },
    });
  });

  it("returns 422 when a template config exceeds the storage limit", async () => {
    const response = await POST(
      jsonRequest("http://localhost/api/flows", {
        name: "Oversized Template",
        description: null,
        graph: createTemplateGraph("x".repeat(MAX_TEMPLATE_LENGTH + 1)),
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_FLOW_DOCUMENT",
        requestId: REQUEST_ID,
      },
    });
  });
});

class InMemoryFlowRepository implements FlowRepository {
  public lastListOptions: { limit?: number } | undefined;
  private readonly records = new Map<string, FlowResource>();

  public async list(options?: { limit?: number }): Promise<FlowResource[]> {
    this.lastListOptions = options;
    const records = [...this.records.values()];
    return options?.limit === undefined
      ? records
      : records.slice(0, options.limit);
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

    if (current.revision !== input.expectedRevision) {
      return {
        status: "conflict",
        currentRevision: current.revision,
      };
    }

    const flow = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: input.expectedRevision + 1,
      createdAt: current.createdAt,
      updatedAt: "2026-06-18T00:01:00.000Z",
    });
    this.records.set(flow.id, flow);

    return { status: "updated", flow };
  }

  public async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
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

function createConfig(): AppConfig {
  return {
    nodeEnv: "test",
    databaseUrl: "file::memory:",
    aiProvider: "fake",
    aiRequestTimeoutMs: 45_000,
    flowRunTimeoutMs: 60_000,
    logLevel: "silent",
  };
}

function createResource(input: {
  id: string;
  name: string;
  description: string | null;
  graph: FlowGraph;
  revision: number;
  createdAt?: string;
  updatedAt?: string;
}): FlowResource {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    graph: input.graph,
    revision: input.revision,
    createdAt: input.createdAt ?? "2026-06-18T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-06-18T00:00:00.000Z",
  };
}

function createEmptyGraph(): FlowGraph {
  return {
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function createTemplateGraph(template: string): FlowGraph {
  return {
    ...createEmptyGraph(),
    nodes: [templateNode(template)],
  };
}

function templateNode(template: string): FlowNode {
  return {
    id: "10000000-0000-4000-8000-000000000101",
    kind: "core.text.template",
    specVersion: 1,
    position: { x: 0, y: 0 },
    label: "Text Template",
    config: {
      template,
    },
  };
}
