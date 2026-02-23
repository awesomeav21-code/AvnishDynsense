import { createDb } from "./index.js";
import { eq } from "drizzle-orm";
import {
  tenants, users, projects, phases, tasks,
  taskAssignments, taskDependencies, comments,
  taskChecklists, checklistItems, tags, taskTags,
  notifications, recurringTaskConfigs, taskReminders,
  auditLog,
} from "./schema/index.js";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);

// Pre-computed bcrypt hash for "password123" (cost 12)
const PASSWORD_HASH = "$2b$12$5t6AFKiPivtsb99gBxVzbO2u9hk1tE.syBUYW7Uh0S/VYgMkSCr3G";

async function seed() {
  // Idempotent: skip if default tenant already has projects
  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, "default"),
  });
  if (existing) {
    const existingProjects = await db.query.projects.findFirst({
      where: eq(projects.tenantId, existing.id),
    });
    if (existingProjects) {
      console.log("Seed data already exists, skipping.");
      process.exit(0);
    }
  }

  console.log("Seeding database with demo data...");

  // --- Tenant ---
  let tenant: { id: string };
  if (existing) {
    tenant = existing;
  } else {
    const [created] = await db.insert(tenants).values({
      name: "Default Tenant",
      slug: "default",
      planTier: "pro",
    }).returning();
    tenant = created!;
  }
  const tid = tenant.id;

  // --- Users (all password: "password123") ---
  const userDefs = [
    { email: "alice@demo.com", name: "Alice Chen", role: "site_admin" as const },
    { email: "bob@demo.com", name: "Bob Martinez", role: "pm" as const },
    { email: "carol@demo.com", name: "Carol Johnson", role: "developer" as const },
    { email: "dave@demo.com", name: "Dave Kim", role: "developer" as const },
    { email: "eve@demo.com", name: "Eve Williams", role: "developer" as const },
  ];

  const insertedUsers = await db.insert(users).values(
    userDefs.map((u) => ({
      tenantId: tid,
      email: u.email,
      passwordHash: PASSWORD_HASH,
      name: u.name,
      role: u.role,
    }))
  ).returning();

  const [alice, bob, carol, dave, eve] = insertedUsers;

  // --- Tags ---
  const tagDefs = [
    { name: "frontend", color: "#3B82F6" },
    { name: "backend", color: "#10B981" },
    { name: "urgent", color: "#EF4444" },
    { name: "bug", color: "#F59E0B" },
    { name: "feature", color: "#8B5CF6" },
    { name: "devops", color: "#6366F1" },
  ];
  const insertedTags = await db.insert(tags).values(
    tagDefs.map((t) => ({ tenantId: tid, name: t.name, color: t.color }))
  ).returning();

  // --- Projects ---
  const projectDefs = [
    { name: "Platform Rebuild", description: "Complete rewrite of the core platform using Next.js and Fastify", status: "active" },
    { name: "Mobile App", description: "iOS and Android companion app for field consultants", status: "active" },
    { name: "Data Migration", description: "Migrate legacy client data from Oracle to PostgreSQL", status: "active" },
  ];
  const insertedProjects = await db.insert(projects).values(
    projectDefs.map((p) => ({ tenantId: tid, ...p }))
  ).returning();

  const allTasks: Array<{ id: string; projectId: string; title: string }> = [];

  for (const project of insertedProjects) {
    // --- Phases ---
    const phaseNames = ["Discovery", "Development", "Testing", "Deployment"];
    const insertedPhases = await db.insert(phases).values(
      phaseNames.map((name, i) => ({
        tenantId: tid,
        projectId: project.id,
        name,
        position: i,
      }))
    ).returning();

    // --- Tasks (15 per project, 45 total) ---
    const taskDefs = [
      { title: "Set up project repository", status: "completed", priority: "high", phase: 0 },
      { title: "Define database schema", status: "completed", priority: "high", phase: 0 },
      { title: "Create wireframes", status: "completed", priority: "medium", phase: 0 },
      { title: "Implement user authentication", status: "completed", priority: "critical", phase: 1 },
      { title: "Build dashboard UI", status: "in_progress", priority: "high", phase: 1 },
      { title: "Create REST API endpoints", status: "in_progress", priority: "high", phase: 1 },
      { title: "Implement search functionality", status: "in_progress", priority: "medium", phase: 1 },
      { title: "Add file upload support", status: "ready", priority: "medium", phase: 1 },
      { title: "Set up CI/CD pipeline", status: "ready", priority: "high", phase: 1 },
      { title: "Write unit tests", status: "ready", priority: "medium", phase: 2 },
      { title: "Integration testing", status: "created", priority: "high", phase: 2 },
      { title: "Performance optimization", status: "created", priority: "low", phase: 2 },
      { title: "Security audit", status: "created", priority: "critical", phase: 2 },
      { title: "Deploy to staging", status: "created", priority: "high", phase: 3 },
      { title: "Production rollout", status: "created", priority: "critical", phase: 3 },
    ];

    const insertedTasks = await db.insert(tasks).values(
      taskDefs.map((t, i) => ({
        tenantId: tid,
        projectId: project.id,
        phaseId: insertedPhases[t.phase]!.id,
        title: t.title,
        description: `${t.title} for ${project.name}`,
        status: t.status,
        priority: t.priority,
        assigneeId: insertedUsers[i % insertedUsers.length]!.id,
        position: i,
        dueDate: new Date(Date.now() + (i - 5) * 86400000 * 2).toISOString(),
      }))
    ).returning();

    allTasks.push(...insertedTasks.map((t) => ({ id: t.id, projectId: project.id, title: t.title })));

    // --- Task Assignments (multiple assignees on some tasks) ---
    for (let i = 0; i < Math.min(5, insertedTasks.length); i++) {
      const secondAssignee = insertedUsers[(i + 2) % insertedUsers.length]!;
      await db.insert(taskAssignments).values({
        taskId: insertedTasks[i]!.id,
        userId: secondAssignee.id,
      }).onConflictDoNothing();
    }

    // --- Task Tags ---
    for (let i = 0; i < insertedTasks.length; i++) {
      const tag = insertedTags[i % insertedTags.length]!;
      await db.insert(taskTags).values({
        taskId: insertedTasks[i]!.id,
        tagId: tag.id,
      }).onConflictDoNothing();
    }

    // --- Dependencies (task 10 blocked by task 5, task 13 blocked by task 10) ---
    if (insertedTasks.length >= 14) {
      await db.insert(taskDependencies).values([
        {
          tenantId: tid,
          blockerTaskId: insertedTasks[4]!.id,
          blockedTaskId: insertedTasks[9]!.id,
          dependencyType: "finish_to_start",
        },
        {
          tenantId: tid,
          blockerTaskId: insertedTasks[9]!.id,
          blockedTaskId: insertedTasks[12]!.id,
          dependencyType: "finish_to_start",
        },
      ]);
    }

    // --- Comments on first 5 tasks ---
    for (let i = 0; i < Math.min(5, insertedTasks.length); i++) {
      const commenter = insertedUsers[(i + 1) % insertedUsers.length]!;
      await db.insert(comments).values({
        tenantId: tid,
        taskId: insertedTasks[i]!.id,
        authorId: commenter.id,
        body: `This looks good. Let me know if you need help with "${insertedTasks[i]!.title}".`,
      });
    }

    // --- Checklists on first 3 tasks ---
    for (let i = 0; i < Math.min(3, insertedTasks.length); i++) {
      const [checklist] = await db.insert(taskChecklists).values({
        tenantId: tid,
        taskId: insertedTasks[i]!.id,
        title: "Acceptance Criteria",
      }).returning();

      const items = ["Review requirements", "Write implementation", "Add tests", "Update docs"];
      for (let j = 0; j < items.length; j++) {
        await db.insert(checklistItems).values({
          checklistId: checklist!.id,
          label: items[j]!,
          completed: j < (i === 0 ? 4 : i === 1 ? 2 : 0),
          position: j,
        });
      }
    }
  }

  // --- Recurring Tasks ---
  await db.insert(recurringTaskConfigs).values([
    {
      tenantId: tid,
      projectId: insertedProjects[0]!.id,
      title: "Weekly standup notes",
      description: "Summarize weekly standup discussion points",
      priority: "medium",
      schedule: "weekly",
      cronExpression: "0 9 * * 1",
      enabled: true,
    },
    {
      tenantId: tid,
      projectId: insertedProjects[0]!.id,
      title: "Monthly security review",
      description: "Review security logs and update dependencies",
      priority: "high",
      schedule: "monthly",
      cronExpression: "0 10 1 * *",
      enabled: true,
    },
  ]);

  // --- Reminders (on first 3 tasks) ---
  for (let i = 0; i < Math.min(3, allTasks.length); i++) {
    await db.insert(taskReminders).values({
      tenantId: tid,
      taskId: allTasks[i]!.id,
      userId: insertedUsers[i % insertedUsers.length]!.id,
      remindAt: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
      channel: "in_app",
    });
  }

  // --- Notifications for alice ---
  const notifDefs = [
    { type: "task_assigned", title: "New task assigned", body: "You've been assigned 'Build dashboard UI'" },
    { type: "comment_added", title: "New comment", body: "Bob commented on 'Create REST API endpoints'" },
    { type: "task_status", title: "Task completed", body: "Carol completed 'Set up project repository'" },
    { type: "mention", title: "You were mentioned", body: "Dave mentioned you in 'Implement search functionality'" },
    { type: "deadline", title: "Deadline approaching", body: "'Security audit' is due in 2 days" },
  ];
  await db.insert(notifications).values(
    notifDefs.map((n) => ({
      tenantId: tid,
      userId: alice!.id,
      type: n.type,
      title: n.title,
      body: n.body,
    }))
  );

  // --- Audit log entries ---
  await db.insert(auditLog).values([
    { tenantId: tid, userId: alice!.id, action: "project.created", entityType: "project", entityId: insertedProjects[0]!.id },
    { tenantId: tid, userId: bob!.id, action: "task.created", entityType: "task", entityId: allTasks[0]!.id },
    { tenantId: tid, userId: carol!.id, action: "task.status_changed", entityType: "task", entityId: allTasks[3]!.id },
    { tenantId: tid, userId: dave!.id, action: "comment.created", entityType: "comment", entityId: allTasks[1]!.id },
  ]);

  console.log("Seed complete:");
  console.log("  1 tenant (Default Tenant)");
  console.log("  5 users (password: password123)");
  console.log("  6 tags");
  console.log("  3 projects, 12 phases, 45 tasks");
  console.log("  Comments, checklists, dependencies, assignments");
  console.log("  Notifications, reminders, recurring tasks, audit log");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
