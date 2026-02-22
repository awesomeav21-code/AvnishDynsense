import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.js";
import { tags } from "./tags.js";

export const taskTags = pgTable("task_tags", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.tagId] }),
]);
