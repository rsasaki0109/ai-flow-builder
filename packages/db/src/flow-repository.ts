import type { FlowGraph, FlowResource } from "@ai-flow-builder/flow-core";

export interface CreateFlowRecord {
  id: string;
  name: string;
  description: string | null;
  graph: FlowGraph;
}

export interface UpdateFlowRecord {
  id: string;
  expectedRevision: number;
  name: string;
  description: string | null;
  graph: FlowGraph;
}

export type UpdateFlowResult =
  | { status: "updated"; flow: FlowResource }
  | { status: "not_found" }
  | { status: "conflict"; currentRevision: number };

export interface FlowRepository {
  list(options?: { limit?: number }): Promise<FlowResource[]>;
  findById(id: string): Promise<FlowResource | null>;
  create(input: CreateFlowRecord): Promise<FlowResource>;
  update(input: UpdateFlowRecord): Promise<UpdateFlowResult>;
  delete(id: string): Promise<boolean>;
}

export class FlowRepositoryError extends Error {
  public readonly operation: string;

  public constructor(operation: string, cause: unknown) {
    super(`Flow repository operation failed: ${operation}`, { cause });
    this.name = "FlowRepositoryError";
    this.operation = operation;
  }
}
