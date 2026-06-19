import type { FlowRepository } from "@ai-flow-builder/db";
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  flowGraphSchema,
  validateStorage,
  type FlowGraph,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { randomUUID } from "node:crypto";
import {
  FlowNotFoundError,
  FlowRevisionConflictError,
  InvalidFlowDocumentError,
} from "../errors.js";

export interface FlowServiceOptions {
  createId?: () => string;
}

export interface ListFlowsInput {
  limit?: number;
}

export interface CreateFlowInput {
  name: string;
  description?: string | null;
  graph?: unknown;
}

export interface UpdateFlowInput {
  id: string;
  expectedRevision: number;
  name: string;
  description: string | null;
  graph: unknown;
}

export class FlowService {
  private readonly createId: () => string;

  public constructor(
    private readonly flowRepository: FlowRepository,
    options: FlowServiceOptions = {},
  ) {
    this.createId = options.createId ?? randomUUID;
  }

  public async list(input: ListFlowsInput = {}): Promise<FlowResource[]> {
    return this.flowRepository.list(input);
  }

  public async get(id: string): Promise<FlowResource> {
    const flow = await this.flowRepository.findById(id);
    if (flow === null) {
      throw new FlowNotFoundError(id);
    }

    return flow;
  }

  public async create(input: CreateFlowInput): Promise<FlowResource> {
    const graph = parseStorageValidGraph(input.graph ?? createEmptyFlowGraph());

    return this.flowRepository.create({
      id: this.createId(),
      name: input.name,
      description: input.description ?? null,
      graph,
    });
  }

  public async update(input: UpdateFlowInput): Promise<FlowResource> {
    const graph = parseStorageValidGraph(input.graph);
    const result = await this.flowRepository.update({
      id: input.id,
      expectedRevision: input.expectedRevision,
      name: input.name,
      description: input.description,
      graph,
    });

    switch (result.status) {
      case "updated":
        return result.flow;
      case "not_found":
        throw new FlowNotFoundError(input.id);
      case "conflict":
        throw new FlowRevisionConflictError(result.currentRevision);
    }
  }

  public async delete(id: string): Promise<void> {
    const deleted = await this.flowRepository.delete(id);
    if (!deleted) {
      throw new FlowNotFoundError(id);
    }
  }
}

function parseStorageValidGraph(input: unknown): FlowGraph {
  const validation = validateStorage(input);
  if (!validation.valid) {
    throw new InvalidFlowDocumentError(validation.issues);
  }

  return flowGraphSchema.parse(input);
}

function createEmptyFlowGraph(): FlowGraph {
  return {
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
