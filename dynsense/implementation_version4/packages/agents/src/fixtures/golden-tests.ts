// Ref: FR-211 — Golden test fixtures for AI evaluation harness
// Each fixture defines: capability, input, expected output keys, min confidence

export interface GoldenFixture {
  id: string;
  name: string;
  capability: string;
  input: Record<string, unknown>;
  expectedOutputKeys: string[];
  minConfidence: number;
}

export const goldenFixtures: GoldenFixture[] = [
  // ── WBS Generator fixtures ──
  {
    id: "wbs-001",
    name: "E-commerce platform redesign",
    capability: "wbs_generator",
    input: {
      description:
        "Redesign an e-commerce platform from scratch. Current system is 10 years old. Team of 4 engineers + 1 designer. Budget: $500k. Timeline: 6 months.",
      constraints: "Backward compatibility with existing integrations. Modern tech stack. 1M+ concurrent users.",
    },
    expectedOutputKeys: ["phases"],
    minConfidence: 0.7,
  },
  {
    id: "wbs-002",
    name: "Mobile fitness app MVP",
    capability: "wbs_generator",
    input: {
      description:
        "Launch an iOS + Android mobile app for fitness tracking. MVP features: user auth, workout logging, social feed, analytics dashboard. Timeline: 4 months, team of 2.",
      constraints: "iOS 14+, Android 11+. No external SDKs for privacy. Must support offline mode.",
    },
    expectedOutputKeys: ["phases"],
    minConfidence: 0.65,
  },
  {
    id: "wbs-003",
    name: "Simple landing page",
    capability: "wbs_generator",
    input: {
      description: "Build a marketing landing page with hero section, feature grid, pricing table, and contact form.",
    },
    expectedOutputKeys: ["phases"],
    minConfidence: 0.75,
  },

  // ── What's Next fixtures ──
  {
    id: "wn-001",
    name: "Prioritize overdue sprint tasks",
    capability: "whats_next",
    input: {
      projectId: "test-project-001",
      assigneeId: "test-user-001",
      context: {
        activeTasks: [
          { id: "t1", title: "API auth module", status: "in_progress", dueDate: "2026-02-20" },
          { id: "t2", title: "Database schema migration", status: "blocked", blockedBy: "t3" },
          { id: "t3", title: "Design review sign-off", status: "in_progress", dueDate: "2026-02-21" },
          { id: "t4", title: "Unit test coverage", status: "created", dueDate: "2026-02-28" },
        ],
        completedToday: ["t5", "t6"],
      },
    },
    expectedOutputKeys: ["items"],
    minConfidence: 0.6,
  },
  {
    id: "wn-002",
    name: "Empty backlog scenario",
    capability: "whats_next",
    input: {
      projectId: "test-project-002",
      assigneeId: "test-user-001",
      context: { activeTasks: [], completedToday: [] },
    },
    expectedOutputKeys: ["items"],
    minConfidence: 0.6,
  },

  // ── NL Query fixtures ──
  {
    id: "nl-001",
    name: "Count overdue tasks",
    capability: "nl_query",
    input: {
      query: "How many tasks are overdue?",
      context: { projectId: "test-project-001" },
    },
    expectedOutputKeys: ["answer"],
    minConfidence: 0.6,
  },
  {
    id: "nl-002",
    name: "Team workload question",
    capability: "nl_query",
    input: {
      query: "Who has the most tasks assigned right now?",
      context: { projectId: "test-project-001" },
    },
    expectedOutputKeys: ["answer"],
    minConfidence: 0.55,
  },

  // ── Summary Writer fixtures ──
  {
    id: "sw-001",
    name: "Weekly status summary",
    capability: "summary_writer",
    input: {
      projectName: "Platform Redesign",
      tasksCompleted: 8,
      tasksInProgress: 5,
      tasksBlocked: 2,
      topBlockers: ["Waiting on API design review", "Database migration script failing"],
      sprintGoal: "Complete API layer and begin frontend integration",
    },
    expectedOutputKeys: ["text"],
    minConfidence: 0.65,
  },

  // ── Risk Predictor fixtures ──
  {
    id: "rp-001",
    name: "Project with multiple overdue tasks",
    capability: "risk_predictor",
    input: {
      projectId: "test-project-001",
      tasks: [
        { id: "t1", title: "API auth", status: "in_progress", dueDate: "2026-02-18", updatedAt: "2026-02-15" },
        { id: "t2", title: "DB migration", status: "in_progress", dueDate: "2026-02-16", updatedAt: "2026-02-10" },
        { id: "t3", title: "Frontend build", status: "blocked", blockedBy: ["t1", "t2"] },
      ],
    },
    expectedOutputKeys: ["risks", "overallRiskScore"],
    minConfidence: 0.6,
  },

  // ── Scope Detector fixtures ──
  {
    id: "sd-001",
    name: "Moderate scope creep",
    capability: "scope_detector",
    input: {
      projectId: "test-project-001",
      baseline: { taskCount: 20, phases: ["Discovery", "Design", "Build", "Deploy"] },
      current: { taskCount: 26, addedTasks: ["Hotfix A", "Feature X", "Bug Y", "Spike Z", "Refactor Q", "Doc update"] },
    },
    expectedOutputKeys: ["scopeVariancePercent", "assessment"],
    minConfidence: 0.6,
  },
];
