// Ref: FR-502 — Deterministic seed script
// 3 tenants, 5 users/tenant, 3 projects/tenant, 20-50 tasks/project
import { createDb } from "./index.js";
import { tenants, users, projects, phases, tasks } from "./schema/index.js";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

async function seed() {
  console.log("Seeding database...");

  // 3 tenants
  const tenantData = [
    { name: "Acme Consulting", slug: "acme", planTier: "pro" },
    { name: "Beta Services", slug: "beta", planTier: "starter" },
    { name: "Gamma Engineering", slug: "gamma", planTier: "enterprise" },
  ] as const;

  const insertedTenants = await db.insert(tenants).values(
    tenantData.map((t) => ({ name: t.name, slug: t.slug, planTier: t.planTier }))
  ).returning();

  for (const tenant of insertedTenants) {
    // 5 users per tenant
    const roles = ["site_admin", "pm", "developer", "developer", "developer"] as const;
    const insertedUsers = await db.insert(users).values(
      roles.map((role, i) => ({
        tenantId: tenant.id,
        email: `user${i + 1}@${tenant.slug}.test`,
        passwordHash: "$2b$12$placeholder.hash.for.seed.data.only",
        name: `${role.charAt(0).toUpperCase() + role.slice(1)} User ${i + 1}`,
        role,
      }))
    ).returning();

    // 3 projects per tenant
    const projectNames = ["Platform Rebuild", "Data Migration", "Client Portal"];
    const insertedProjects = await db.insert(projects).values(
      projectNames.map((name) => ({
        tenantId: tenant.id,
        name,
        description: `${name} project for ${tenant.name}`,
        status: "active",
      }))
    ).returning();

    for (const project of insertedProjects) {
      // 3 phases per project
      const phaseNames = ["Discovery", "Build", "Deliver"];
      const insertedPhases = await db.insert(phases).values(
        phaseNames.map((name, i) => ({
          tenantId: tenant.id,
          projectId: project.id,
          name,
          position: i,
        }))
      ).returning();

      // 20 tasks per project spread across phases
      const taskData = Array.from({ length: 20 }, (_, i) => ({
        tenantId: tenant.id,
        projectId: project.id,
        phaseId: insertedPhases[i % 3]!.id,
        title: `Task ${i + 1} for ${project.name}`,
        description: `Description for task ${i + 1}`,
        status: i < 5 ? "completed" : i < 10 ? "in_progress" : i < 15 ? "ready" : "created",
        priority: i % 4 === 0 ? "critical" : i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
        assigneeId: insertedUsers[i % insertedUsers.length]!.id,
        position: i,
      }));

      await db.insert(tasks).values(taskData);
    }
  }

  console.log("Seed complete: 3 tenants, 15 users, 9 projects, 180 tasks");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
