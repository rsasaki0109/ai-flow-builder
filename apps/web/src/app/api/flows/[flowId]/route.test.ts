import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "@ai-flow-builder/db";
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowGraph,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../../server/config.js";
import { setServerContainerForTest } from "../../../../server/container.js";
import { FlowService } from "../../../../server/services/flow-service.js";
import { DELETE, GET, PUT } from "./route.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const MISSING_FLOW_ID = "10000000-0000-4000-8000-000000000999";
const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

let repository: InMemoryFlowRepository;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
  setServerContainerForTest({
    config: createConfig(),
    flowRepository: repository,
    flowService: new FlowService(repository),
    dispose: () => undefined,
  });
});

afterEach(() => {
  setServerContainerForTest(null);
});

describe("/api/flows/[flowId] route", () => {
  it("returns 404 when a flow is missing", async () => {
    const response = await GET(
      routeRequest("GET", `http://localhost/api/flows/${MISSING_FLOW_ID}`),
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

  it("returns 409 when the expected revision is stale", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Existing Flow",
      description: null,
      graph: createEmptyGraph(),
    });
    await repository.update({
      id: FLOW_ID,
      expectedRevision: 1,
      name: "Existing Flow v2",
      description: null,
      graph: createEmptyGraph(),
    });

    const response = await PUT(
      routeRequest("PUT", `http://localhost/api/flows/${FLOW_ID}`, {
        expectedRevision: 1,
        name: "Stale Update",
        description: null,
        graph: createEmptyGraph(),
      }),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: {
        code: "FLOW_REVISION_CONFLICT",
        requestId: REQUEST_ID,
        details: { currentRevision: 2 },
      },
    });
  });

  it("deletes an existing flow and returns 204", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Delete Me",
      description: null,
      graph: createEmptyGraph(),
    });

    const response = await DELETE(
      routeRequest("DELETE", `http://localhost/api/flows/${FLOW_ID}`),
      routeContext(FLOW_ID),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(await repository.findById(FLOW_ID)).toBeNull();
  });
});

class InMemoryFlowRepository implements FlowRepository {
  private readonly records = new Map<string, FlowResource>();

  public async list(options?: { limit?: number }): Promise<FlowResource[]> {
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

function routeContext(flowId: string): { params: Promise<{ flowId: string }> } {
  return { params: Promise.resolve({ flowId }) };
}

function routeRequest(method: string, url: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: {
      "content-type": "application/json",
      "x-request-id": REQUEST_ID,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };

  return new Request(url, {
    ...init,
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
