// Ref: FR-607 — mentions table (tenant-scoped)
// Ref: FR-128 — @mention parsing (UUID extraction)
import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { comments } from "./comments.js";
import { users } from "./users.js";

export const mentions = pgTable("mentions", {
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.commentId, table.userId] }),
  index("mentions_user_idx").on(table.userId),
]);
