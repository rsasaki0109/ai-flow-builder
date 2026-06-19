import { createClient, type Client } from "@libsql/client";
import type { FlowGraph } from "@ai-flow-builder/flow-core";
import { flowGraphSchema } from "@ai-flow-builder/flow-core";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DrizzleFlowRepository,
  type FlowDatabase,
} from "./drizzle-flow-repository.js";
import { FlowRepositoryError } from "./flow-repository.js";
import * as schema from "./schema.js";

const FLOW_ID_1 = "10000000-0000-4000-8000-000000000001";
const FLOW_ID_2 = "10000000-0000-4000-8000-000000000002";
const FLOW_ID_3 = "10000000-0000-4000-8000-000000000003";
const MISSING_FLOW_ID = "10000000-0000-4000-8000-000000000999";
const INPUT_NODE_ID = "20000000-0000-4000-8000-000000000001";
const OUTPUT_NODE_ID = "20000000-0000-4000-8000-000000000002";
const EDGE_ID = "30000000-0000-4000-8000-000000000001";

interface TestRepository {
  repo: DrizzleFlowRepository;
  client: Client;
  dbDir: string;
}

const testRepositories: TestRepository[] = [];

afterEach(async () => {
  await Promise.all(
    testRepositories.splice(0).map(async ({ client, dbDir }) => {
      client.close();
      await rm(dbDir, { recursive: true, force: true });
    }),
  );
});

describe("DrizzleFlowRepository", () => {
  it("creates, finds, and round-trips flow graph JSON", async () => {
    const { repo, client } = await createTestRepository(
      sequenceClock("2026-06-18T00:00:00.000Z"),
    );
    const graph = createGraph({ template: "Hello {{input}}", viewportX: 25 });

    const created = await repo.create({
      id: FLOW_ID_1,
      name: "Greeting Flow",
      description: "Greets input text",
      graph,
    });

    expect(created).toEqual({
      id: FLOW_ID_1,
      name: "Greeting Flow",
      description: "Greets input text",
      graph,
      revision: 1,
      createdAt: "2026-06-18T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
    });
    await expect(repo.findById(FLOW_ID_1)).resolves.toEqual(created);

    const stored = await client.execute({
      sql: "SELECT graph_json FROM flows WHERE id = ?",
      args: [FLOW_ID_1],
    });
    expect(JSON.parse(String(stored.rows.at(0)?.["graph_json"]))).toEqual(
      graph,
    );
  });

  it("lists flows by updated_at descending with an optional limit", async () => {
    const { repo } = await createTestRepository(
      sequenceClock(
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:01:00.000Z",
        "2026-06-18T00:02:00.000Z",
      ),
    );

    await repo.create({
      id: FLOW_ID_1,
      name: "First",
      description: null,
      graph: createGraph(),
    });
    await repo.create({
      id: FLOW_ID_2,
      name: "Second",
      description: null,
      graph: createGraph({ viewportX: 100 }),
    });
    await repo.create({
      id: FLOW_ID_3,
      name: "Third",
      description: null,
      graph: createGraph({ viewportX: 200 }),
    });

    await expect(repo.list()).resolves.toMatchObject([
      { id: FLOW_ID_3 },
      { id: FLOW_ID_2 },
      { id: FLOW_ID_1 },
    ]);
    await expect(repo.list({ limit: 2 })).resolves.toMatchObject([
      { id: FLOW_ID_3 },
      { id: FLOW_ID_2 },
    ]);
  });

  it("updates a flow, increments revision, and detects stale revisions", async () => {
    const { repo } = await createTestRepository(
      sequenceClock("2026-06-18T00:00:00.000Z", "2026-06-18T00:05:00.000Z"),
    );
    await repo.create({
      id: FLOW_ID_1,
      name: "Original",
      description: null,
      graph: createGraph(),
    });

    const updatedGraph = createGraph({
      template: "Updated {{input}}",
      viewportX: 75,
    });
    await expect(
      repo.update({
        id: FLOW_ID_1,
        expectedRevision: 1,
        name: "Updated",
        description: "Changed",
        graph: updatedGraph,
      }),
    ).resolves.toEqual({
      status: "updated",
      flow: {
        id: FLOW_ID_1,
        name: "Updated",
        description: "Changed",
        graph: updatedGraph,
        revision: 2,
        createdAt: "2026-06-18T00:00:00.000Z",
        updatedAt: "2026-06-18T00:05:00.000Z",
      },
    });

    await expect(
      repo.update({
        id: FLOW_ID_1,
        expectedRevision: 1,
        name: "Stale",
        description: null,
        graph: createGraph(),
      }),
    ).resolves.toEqual({ status: "conflict", currentRevision: 2 });
  });

  it("returns not_found when updating or deleting a missing flow", async () => {
    const { repo } = await createTestRepository(
      sequenceClock("2026-06-18T00:00:00.000Z"),
    );

    await expect(
      repo.update({
        id: MISSING_FLOW_ID,
        expectedRevision: 1,
        name: "Missing",
        description: null,
        graph: createGraph(),
      }),
    ).resolves.toEqual({ status: "not_found" });
    await expect(repo.delete(MISSING_FLOW_ID)).resolves.toBe(false);
  });

  it("deletes an existing flow", async () => {
    const { repo } = await createTestRepository(
      sequenceClock("2026-06-18T00:00:00.000Z"),
    );
    await repo.create({
      id: FLOW_ID_1,
      name: "Delete Me",
      description: null,
      graph: createGraph(),
    });

    await expect(repo.delete(FLOW_ID_1)).resolves.toBe(true);
    await expect(repo.findById(FLOW_ID_1)).resolves.toBeNull();
    await expect(repo.delete(FLOW_ID_1)).resolves.toBe(false);
  });

  it("wraps database errors in FlowRepositoryError", async () => {
    const { repo } = await createTestRepository(
      sequenceClock("2026-06-18T00:00:00.000Z"),
    );
    const input = {
      id: FLOW_ID_1,
      name: "Duplicate",
      description: null,
      graph: createGraph(),
    };

    await repo.create(input);
    await expect(repo.create(input)).rejects.toMatchObject({
      name: "FlowRepositoryError",
      operation: "create",
    });
    await expect(repo.create(input)).rejects.toBeInstanceOf(
      FlowRepositoryError,
    );
  });
});

async function createTestRepository(now: () => Date): Promise<TestRepository> {
  const dbDir = await mkdtemp(join(tmpdir(), "ai-flow-builder-repo-"));
  const client = createClient({ url: `file:${join(dbDir, "repository.db")}` });
  await client.executeMultiple(await readMigrationSql());

  const db: FlowDatabase = drizzle(client, { schema });
  const repo = new DrizzleFlowRepository(db, { now });
  const testRepository = { repo, client, dbDir };
  testRepositories.push(testRepository);

  return testRepository;
}

async function readMigrationSql(): Promise<string> {
  const migrationsUrl = new URL("../migrations/", import.meta.url);
  const entries = await readdir(migrationsUrl);
  const migrationFiles = entries.filter((entry) => entry.endsWith(".sql"));

  expect(migrationFiles).toHaveLength(1);

  const [migrationFile] = migrationFiles;
  if (migrationFile === undefined) {
    throw new Error("Expected one SQL migration file.");
  }

  return readFile(
    new URL(`../migrations/${migrationFile}`, import.meta.url),
    "utf8",
  );
}

function sequenceClock(
  firstIso: string,
  ...remainingIso: string[]
): () => Date {
  const isoValues = [firstIso, ...remainingIso];
  let index = 0;

  return () => {
    const fallbackIso = isoValues[isoValues.length - 1];
    if (fallbackIso === undefined) {
      throw new Error("Expected at least one clock value.");
    }

    const iso = isoValues[index] ?? fallbackIso;
    index += 1;

    return new Date(iso);
  };
}

function createGraph(
  options: {
    template?: string;
    viewportX?: number;
  } = {},
): FlowGraph {
  return flowGraphSchema.parse({
    schemaVersion: 1,
    nodes: [
      {
        id: INPUT_NODE_ID,
        kind: "core.input.text",
        specVersion: 1,
        position: { x: 0, y: 0 },
        label: "Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
      {
        id: OUTPUT_NODE_ID,
        kind: "core.text.template",
        specVersion: 1,
        position: { x: 300, y: 0 },
        label: "Template",
        config: {
          template: options.template ?? "{{input}}",
        },
      },
    ],
    edges: [
      {
        id: EDGE_ID,
        source: {
          nodeId: INPUT_NODE_ID,
          portId: "value",
        },
        target: {
          nodeId: OUTPUT_NODE_ID,
          portId: "input",
        },
      },
    ],
    viewport: {
      x: options.viewportX ?? 0,
      y: 0,
      zoom: 1,
    },
  });
}
