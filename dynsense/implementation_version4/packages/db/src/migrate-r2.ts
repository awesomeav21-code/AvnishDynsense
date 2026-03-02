import { createDb } from "./index.js";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }

const db = createDb(DATABASE_URL);

async function run() {
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT false`);
  console.log("Added client_visible to tasks");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_members (
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'client',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_id, user_id)
    )
  `);
  console.log("Created project_members table");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invite_links (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      token VARCHAR(64) NOT NULL UNIQUE,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      used_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invite_links_token_idx ON invite_links(token)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS invite_links_tenant_idx ON invite_links(tenant_id)`);
  console.log("Created invite_links table");

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
