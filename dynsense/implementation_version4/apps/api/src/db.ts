import { createDb, type Database } from "@dynsense/db";
import type { Env } from "./config/env.js";

let db: Database | null = null;

export function getDb(env: Env): Database {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
