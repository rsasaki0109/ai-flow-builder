import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const flows = sqliteTable(
  "flows",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    graphJson: text("graph_json").notNull(),
    schemaVersion: integer("schema_version", { mode: "number" }).notNull(),
    revision: integer("revision", { mode: "number" }).notNull().default(1),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("flows_updated_at_idx").on(sql`${table.updatedAt} desc`)],
);

export type FlowRecord = typeof flows.$inferSelect;
export type NewFlowRecord = typeof flows.$inferInsert;
