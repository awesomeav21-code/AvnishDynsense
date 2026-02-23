import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  const migrationsFolder = path.resolve(__dirname, "../migrations");
  console.log(`Running migrations from ${migrationsFolder}...`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
