import { pgTable, uuid, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { customFieldDefinitions } from "./custom-field-definitions.js";

export const customFieldValues = pgTable("custom_field_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fieldId: uuid("field_id").notNull().references(() => customFieldDefinitions.id, { onDelete: "cascade" }),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("custom_field_values_task_field_idx").on(table.taskId, table.fieldId),
  index("custom_field_values_field_idx").on(table.fieldId),
]);
