import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Runtime database URLs are validated by apps/web/src/server/config.ts.
// This default exists only for local drizzle-kit commands.
const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");
const defaultDatabaseUrl = `file:${resolve(repoRoot, "data/ai-flow-builder.db")}`;

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
