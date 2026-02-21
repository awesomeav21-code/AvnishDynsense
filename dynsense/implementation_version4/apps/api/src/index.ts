// Ref: design-doc §3.2 — Fastify API server entry point with health check
import { config } from "dotenv";
config({ path: "../../.env" });

import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    console.log(`Dynsense API running on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
