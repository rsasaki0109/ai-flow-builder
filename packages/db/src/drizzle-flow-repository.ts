import {
  flowGraphSchema,
  flowResourceSchema,
  type FlowGraph,
  type FlowResource,
} from "@ai-flow-builder/flow-core";
import { and, desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  CreateFlowRecord,
  FlowRepository,
  UpdateFlowRecord,
  UpdateFlowResult,
} from "./flow-repository.js";
import { FlowRepositoryError } from "./flow-repository.js";
import { flows, type FlowRecord } from "./schema.js";
import * as schema from "./schema.js";

export type FlowDatabase = LibSQLDatabase<typeof schema>;

export interface DrizzleFlowRepositoryOptions {
  now?: () => Date;
}

export class DrizzleFlowRepository implements FlowRepository {
  private readonly now: () => Date;

  public constructor(
    private readonly db: FlowDatabase,
    options: DrizzleFlowRepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  public async list(options?: { limit?: number }): Promise<FlowResource[]> {
    return withRepositoryError("list", async () => {
      const orderedQuery = this.db
        .select()
        .from(flows)
        .orderBy(desc(flows.updatedAt));
      const records =
        options?.limit === undefined
          ? await orderedQuery
          : await orderedQuery.limit(options.limit);

      return records.map(flowRecordToResource);
    });
  }

  public async findById(id: string): Promise<FlowResource | null> {
    return withRepositoryError("findById", async () => {
      const records = await this.db
        .select()
        .from(flows)
        .where(eq(flows.id, id))
        .limit(1);

      const record = records.at(0);
      return record === undefined ? null : flowRecordToResource(record);
    });
  }

  public async create(input: CreateFlowRecord): Promise<FlowResource> {
    return withRepositoryError("create", async () => {
      const nowMs = this.now().getTime();
      const records = await this.db
        .insert(flows)
        .values({
          id: input.id,
          name: input.name,
          description: input.description,
          graphJson: serializeFlowGraph(input.graph),
          schemaVersion: input.graph.schemaVersion,
          revision: 1,
          createdAt: nowMs,
          updatedAt: nowMs,
        })
        .returning();

      return flowRecordToResource(requireSingleRecord("create", records));
    });
  }

  public async update(input: UpdateFlowRecord): Promise<UpdateFlowResult> {
    return withRepositoryError("update", async () => {
      const nowMs = this.now().getTime();
      const records = await this.db
        .update(flows)
        .set({
          name: input.name,
          description: input.description,
          graphJson: serializeFlowGraph(input.graph),
          schemaVersion: input.graph.schemaVersion,
          revision: input.expectedRevision + 1,
          updatedAt: nowMs,
        })
        .where(
          and(
            eq(flows.id, input.id),
            eq(flows.revision, input.expectedRevision),
          ),
        )
        .returning();

      const updatedRecord = records.at(0);
      if (updatedRecord !== undefined) {
        return { status: "updated", flow: flowRecordToResource(updatedRecord) };
      }

      const existingRecords = await this.db
        .select({ revision: flows.revision })
        .from(flows)
        .where(eq(flows.id, input.id))
        .limit(1);
      const existingRecord = existingRecords.at(0);

      if (existingRecord === undefined) {
        return { status: "not_found" };
      }

      return {
        status: "conflict",
        currentRevision: existingRecord.revision,
      };
    });
  }

  public async delete(id: string): Promise<boolean> {
    return withRepositoryError("delete", async () => {
      const deletedRecords = await this.db
        .delete(flows)
        .where(eq(flows.id, id))
        .returning({ id: flows.id });

      return deletedRecords.length > 0;
    });
  }
}

function serializeFlowGraph(graph: FlowGraph): string {
  return JSON.stringify(flowGraphSchema.parse(graph));
}

function parseFlowGraph(graphJson: string): FlowGraph {
  const parsed: unknown = JSON.parse(graphJson);
  return flowGraphSchema.parse(parsed);
}

function flowRecordToResource(record: FlowRecord): FlowResource {
  return flowResourceSchema.parse({
    id: record.id,
    name: record.name,
    description: record.description,
    graph: parseFlowGraph(record.graphJson),
    revision: record.revision,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
  });
}

function requireSingleRecord(
  operation: string,
  records: readonly FlowRecord[],
): FlowRecord {
  const record = records.at(0);
  if (record === undefined) {
    throw new FlowRepositoryError(
      operation,
      new Error("Expected database to return one flow record."),
    );
  }

  return record;
}

async function withRepositoryError<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (cause) {
    if (cause instanceof FlowRepositoryError) {
      throw cause;
    }

    throw new FlowRepositoryError(operation, cause);
  }
}
