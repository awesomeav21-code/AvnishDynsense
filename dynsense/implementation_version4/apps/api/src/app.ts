// Ref: design-doc §3.2 — Fastify 5 application factory
// Ref: design-doc §3.1 — Fastify API with 14 modules under /api/v1
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { errorHandler } from "./middleware/error-handler.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { userRoutes } from "./routes/users.js";
import { commentRoutes } from "./routes/comments.js";
import { checklistRoutes } from "./routes/checklists.js";
import { dependencyRoutes } from "./routes/dependencies.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { auditRoutes } from "./routes/audit.js";
import { configRoutes } from "./routes/config.js";
import { aiRoutes } from "./routes/ai.js";
import { notificationRoutes } from "./routes/notifications.js";
import { viewRoutes } from "./routes/views.js";
import { integrationRoutes } from "./routes/integrations.js";
import { tagRoutes } from "./routes/tags.js";
import { searchRoutes } from "./routes/search.js";
import { featureFlagRoutes } from "./routes/feature-flags.js";
import { recurringTaskRoutes } from "./routes/recurring-tasks.js";
import { reminderRoutes } from "./routes/reminders.js";
import { cronRoutes } from "./routes/cron.js";
import { phaseRoutes } from "./routes/phases.js";
import { aiEvalRoutes } from "./routes/ai-eval.js";
import { ssoRoutes } from "./routes/sso.js";
import { slackRoutes } from "./routes/slack.js";
import { githubRoutes } from "./routes/github.js";
import { customFieldRoutes } from "./routes/custom-fields.js";
import { templateRoutes } from "./routes/templates.js";
import { customToolRoutes } from "./routes/custom-tools.js";
import { sseRoutes } from "./routes/sse.js";
import type { Env } from "./config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    env: Env;
  }
}

export async function buildApp(env: Env) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: env.NODE_ENV === "development"
        ? { target: "pino-pretty" }
        : undefined,
    },
  });

  // Decorate env so routes can access it
  app.decorate("env", env);

  // CORS
  await app.register(cors, { origin: true });

  // JWT (HS256 for R0)
  await app.register(jwt, { secret: env.JWT_SECRET });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  }));

  // API v1 prefix — route modules
  app.register(async (api) => {
    api.get("/", async () => ({ message: "Dynsense API v1" }));

    api.register(authRoutes, { prefix: "/auth" });
    api.register(projectRoutes, { prefix: "/projects" });
    api.register(taskRoutes, { prefix: "/tasks" });
    api.register(userRoutes, { prefix: "/users" });
    api.register(commentRoutes, { prefix: "/comments" });
    api.register(checklistRoutes, { prefix: "/checklists" });
    api.register(dependencyRoutes, { prefix: "/dependencies" });
    api.register(assignmentRoutes, { prefix: "/assignments" });
    api.register(auditRoutes, { prefix: "/audit" });
    api.register(configRoutes, { prefix: "/config" });
    api.register(aiRoutes, { prefix: "/ai" });
    api.register(notificationRoutes, { prefix: "/notifications" });
    api.register(viewRoutes, { prefix: "/views" });
    api.register(integrationRoutes, { prefix: "/integrations" });
    api.register(tagRoutes, { prefix: "/tags" });
    api.register(searchRoutes, { prefix: "/search" });
    api.register(featureFlagRoutes, { prefix: "/feature-flags" });
    api.register(recurringTaskRoutes, { prefix: "/recurring-tasks" });
    api.register(reminderRoutes, { prefix: "/reminders" });
    api.register(cronRoutes, { prefix: "/cron" });
    api.register(phaseRoutes, { prefix: "/phases" });
    api.register(aiEvalRoutes, { prefix: "/ai-eval" });
    api.register(ssoRoutes, { prefix: "/sso" });
    api.register(slackRoutes, { prefix: "/slack" });
    api.register(githubRoutes, { prefix: "/github" });
    api.register(customFieldRoutes, { prefix: "/custom-fields" });
    api.register(templateRoutes, { prefix: "/templates" });
    api.register(customToolRoutes, { prefix: "/custom-tools" });
    api.register(sseRoutes, { prefix: "/sse" });
  }, { prefix: "/api/v1" });

  return app;
}
