import { defineConfig } from "drizzle-kit";

// Runtime database URLs are validated by apps/web/src/server/config.ts.
// This default exists only for local drizzle-kit commands.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./data/ai-flow-builder.db",
  },
  strict: true,
  verbose: true,
});
