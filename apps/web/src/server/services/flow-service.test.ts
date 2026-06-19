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
import { beforeEach, describe, expect, it } from "vitest";
import { FlowNotFoundError, InvalidFlowDocumentError } from "../errors.js";
import { FlowService } from "./flow-service.js";

const FLOW_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_FLOW_ID = "10000000-0000-4000-8000-000000000002";

let repository: InMemoryFlowRepository;
let service: FlowService;

beforeEach(() => {
  repository = new InMemoryFlowRepository();
  service = new FlowService(repository, { createId: () => FLOW_ID });
});

describe("FlowService", () => {
  it("lists flows through the repository", async () => {
    const existing = await repository.create({
      id: FLOW_ID,
      name: "Existing",
      description: null,
      graph: createStorageValidGraph(),
    });

    await expect(service.list({ limit: 10 })).resolves.toEqual([existing]);
    expect(repository.lastListOptions).toEqual({ limit: 10 });
  });

  it("gets a flow or throws FlowNotFoundError", async () => {
    const existing = await repository.create({
      id: FLOW_ID,
      name: "Existing",
      description: null,
      graph: createStorageValidGraph(),
    });

    await expect(service.get(FLOW_ID)).resolves.toEqual(existing);
    await expect(service.get(OTHER_FLOW_ID)).rejects.toBeInstanceOf(
      FlowNotFoundError,
    );
  });

  it("creates a flow with generated ID, null description, and default empty graph", async () => {
    const created = await service.create({ name: "Untitled Flow" });

    expect(created).toMatchObject({
      id: FLOW_ID,
      name: "Untitled Flow",
      description: null,
      revision: 1,
      graph: createEmptyGraph(),
    });
    expect(repository.createdRecords).toEqual([
      {
        id: FLOW_ID,
        name: "Untitled Flow",
        description: null,
        graph: createEmptyGraph(),
      },
    ]);
  });

  it("rejects invalid flow documents before create", async () => {
    await expect(
      service.create({
        name: "Invalid",
        graph: {
          ...createEmptyGraph(),
          viewport: { x: 0, y: 0, zoom: 99 },
        },
      }),
    ).rejects.toBeInstanceOf(InvalidFlowDocumentError);
    expect(repository.createdRecords).toEqual([]);
  });

  it("updates a storage-valid flow and returns the updated resource", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Original",
      description: null,
      graph: createStorageValidGraph(),
    });
    const graph = createStorageValidGraph({ viewportX: 120 });

    const updated = await service.update({
      id: FLOW_ID,
      expectedRevision: 1,
      name: "Updated",
      description: "Changed",
      graph,
    });

    expect(updated).toMatchObject({
      id: FLOW_ID,
      name: "Updated",
      description: "Changed",
      revision: 2,
      graph,
    });
  });

  it("rejects invalid flow documents before update", async () => {
    await expect(
      service.update({
        id: FLOW_ID,
        expectedRevision: 1,
        name: "Invalid",
        description: null,
        graph: {
          ...createEmptyGraph(),
          nodes: [{ id: "not-a-uuid" }],
        },
      }),
    ).rejects.toBeInstanceOf(InvalidFlowDocumentError);
    expect(repository.updatedRecords).toEqual([]);
  });

  it("maps update not_found and conflict results to application errors", async () => {
    await expect(
      service.update({
        id: FLOW_ID,
        expectedRevision: 1,
        name: "Missing",
        description: null,
        graph: createStorageValidGraph(),
      }),
    ).rejects.toBeInstanceOf(FlowNotFoundError);

    await repository.create({
      id: FLOW_ID,
      name: "Existing",
      description: null,
      graph: createStorageValidGraph(),
    });

    await expect(
      service.update({
        id: FLOW_ID,
        expectedRevision: 0,
        name: "Stale",
        description: null,
        graph: createStorageValidGraph(),
      }),
    ).rejects.toMatchObject({
      name: "FlowRevisionConflictError",
      code: "FLOW_REVISION_CONFLICT",
      details: { currentRevision: 1 },
    });
  });

  it("deletes a flow or throws FlowNotFoundError", async () => {
    await repository.create({
      id: FLOW_ID,
      name: "Delete Me",
      description: null,
      graph: createStorageValidGraph(),
    });

    await expect(service.delete(FLOW_ID)).resolves.toBeUndefined();
    await expect(service.delete(FLOW_ID)).rejects.toBeInstanceOf(
      FlowNotFoundError,
    );
  });
});

class InMemoryFlowRepository implements FlowRepository {
  public readonly createdRecords: CreateFlowRecord[] = [];
  public readonly updatedRecords: UpdateFlowRecord[] = [];
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
    this.createdRecords.push(input);
    const resource = createResource({
      id: input.id,
      name: input.name,
      description: input.description,
      graph: input.graph,
      revision: 1,
    });
    this.records.set(resource.id, resource);

    return resource;
  }

  public async update(input: UpdateFlowRecord): Promise<UpdateFlowResult> {
    this.updatedRecords.push(input);
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

function createStorageValidGraph(
  options: { viewportX?: number } = {},
): FlowGraph {
  return {
    ...createEmptyGraph(),
    viewport: { x: options.viewportX ?? 0, y: 0, zoom: 1 },
  };
}
