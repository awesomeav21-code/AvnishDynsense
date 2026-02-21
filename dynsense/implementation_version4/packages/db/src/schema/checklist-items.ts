// Ref: FR-609 — checklist_items table
// Ref: FR-127 — completion tracking with percentage stats
import { pgTable, uuid, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { taskChecklists } from "./task-checklists.js";

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  checklistId: uuid("checklist_id").notNull().references(() => taskChecklists.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 500 }).notNull(),
  completed: boolean("completed").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
