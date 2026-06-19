import { createClient } from "@libsql/client";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("flows migration", () => {
  it("creates the single application table and updated_at index", async () => {
    const dbDir = await mkdtemp(join(tmpdir(), "ai-flow-builder-db-"));
    const client = createClient({ url: `file:${join(dbDir, "migration.db")}` });

    try {
      await client.executeMultiple(await readMigrationSql());

      const tableInfo = await client.execute("PRAGMA table_info(flows)");
      const columns = tableInfo.rows.map((row) => ({
        name: String(row["name"]),
        type: String(row["type"]).toLowerCase(),
        notNull: Number(row["notnull"]),
        defaultValue:
          row["dflt_value"] === null ? null : String(row["dflt_value"]),
        primaryKey: Number(row["pk"]),
      }));

      expect(columns).toEqual([
        {
          name: "id",
          type: "text",
          notNull: 1,
          defaultValue: null,
          primaryKey: 1,
        },
        {
          name: "name",
          type: "text",
          notNull: 1,
          defaultValue: null,
          primaryKey: 0,
        },
        {
          name: "description",
          type: "text",
          notNull: 0,
          defaultValue: null,
          primaryKey: 0,
        },
        {
          name: "graph_json",
          type: "text",
          notNull: 1,
          defaultValue: null,
          primaryKey: 0,
        },
        {
          name: "schema_version",
          type: "integer",
          notNull: 1,
          defaultValue: null,
          primaryKey: 0,
        },
        {
          name: "revision",
          type: "integer",
          notNull: 1,
          defaultValue: "1",
          primaryKey: 0,
        },
        {
          name: "created_at",
          type: "integer",
          notNull: 1,
          defaultValue: null,
          primaryKey: 0,
        },
        {
          name: "updated_at",
          type: "integer",
          notNull: 1,
          defaultValue: null,
          primaryKey: 0,
        },
      ]);

      const indexes = await client.execute("PRAGMA index_list(flows)");
      const explicitIndexNames = indexes.rows
        .map((row) => String(row["name"]))
        .filter((name) => !name.startsWith("sqlite_autoindex_"));
      expect(explicitIndexNames).toEqual(["flows_updated_at_idx"]);

      const indexDefinitions = await client.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'flows_updated_at_idx'",
      );
      expect(indexDefinitions.rows.at(0)?.["sql"]).toBe(
        'CREATE INDEX `flows_updated_at_idx` ON `flows` ("updated_at" desc)',
      );
    } finally {
      client.close();
      await rm(dbDir, { recursive: true, force: true });
    }
  });

  it("uses revision 1 when a flow record is inserted without an explicit revision", async () => {
    const dbDir = await mkdtemp(join(tmpdir(), "ai-flow-builder-db-"));
    const client = createClient({ url: `file:${join(dbDir, "defaults.db")}` });

    try {
      await client.executeMultiple(await readMigrationSql());
      await client.execute({
        sql: [
          "INSERT INTO flows",
          "(id, name, graph_json, schema_version, created_at, updated_at)",
          "VALUES (?, ?, ?, ?, ?, ?)",
        ].join(" "),
        args: [
          "flow-1",
          "Test Flow",
          '{"schemaVersion":1}',
          1,
          1_781_833_700_000,
          1_781_833_700_000,
        ],
      });

      const selected = await client.execute(
        "SELECT revision FROM flows WHERE id = 'flow-1'",
      );
      expect(selected.rows.at(0)?.["revision"]).toBe(1);
    } finally {
      client.close();
      await rm(dbDir, { recursive: true, force: true });
    }
  });
});
