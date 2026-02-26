import { createDb } from "./index.js";
import { eq, sql, asc } from "drizzle-orm";
import {
  tenants, users, accounts, projects, phases, tasks,
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

// Pre-computed bcrypt hashes (cost 12) — each user has a unique password
const PASSWORD_HASHES: Record<string, string> = {
  "Admin@2026": "$2b$12$L/MHDwV0dsxeBBMkPDh/K./z6uD8pTuy.0.bZe/XYU8Q65VCnGMZC",
  "BobPM#456": "$2b$12$u.V898w.Yrf2HUXYaOkjCeI1p0VQPcJvV1omEIVaD4HqVjVypXQ1i",
  "Carol!Dev7": "$2b$12$Nu9hHF8mGVbxEdB7qpTXc.bXhcoXRSPJ3Fy8oQIrG0G3yhMA/YCQm",
  "DaveK!m89": "$2b$12$CbbWf5et.DVb4./OI2Vjx.RGnnDuZ5.FJcXEEIO3noOI983cdIkwm",
  "EveW!ll01": "$2b$12$CNGq04sBVRCbwFnubRZ9L.RCrBjAfxmI2MIIlbvNkg7MKCa7I6XVO",
  "Frank@Cl1": "$2b$12$xWsUEdFGDks2cqTToPA6OerWjty/34J37bDd5b2mKG5oPHxcjh.ia",
  "Grace#Cl2": "$2b$12$caD.1oTyakRttQ6sKYD7Bu5uXcOHNb0BCofdNBJlndaXSVB.C6k06",
};

async function seed() {
  console.log("Seeding database with comprehensive demo data...");

  // --- Find or create tenant ---
  let existingTenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, "dynsense"),
  });
  if (!existingTenant) {
    // Try legacy slug
    existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, "default"),
    });
  }
  if (!existingTenant) {
    // Create the tenant if it doesn't exist
    const [created] = await db.insert(tenants).values({
      name: "Dynsense",
      slug: "dynsense",
      planTier: "starter",
    }).returning();
    existingTenant = created!;
  } else {
    // Rename to proper workspace name
    await db.update(tenants).set({ name: "Dynsense", slug: "dynsense" }).where(eq(tenants.id, existingTenant.id));
  }
  const tid = existingTenant.id;

  // --- Clean existing seed data (preserve tenant and existing users) ---
  console.log("  Cleaning old data...");
  await db.delete(notifications).where(eq(notifications.tenantId, tid));
  await db.delete(auditLog).where(eq(auditLog.tenantId, tid));
  await db.delete(taskReminders).where(eq(taskReminders.tenantId, tid));
  await db.delete(recurringTaskConfigs).where(eq(recurringTaskConfigs.tenantId, tid));
  await db.delete(taskTags).where(
    sql`task_id IN (SELECT id FROM tasks WHERE tenant_id = ${tid})`
  );
  await db.delete(taskAssignments).where(
    sql`task_id IN (SELECT id FROM tasks WHERE tenant_id = ${tid})`
  );
  await db.delete(checklistItems).where(
    sql`checklist_id IN (SELECT tc.id FROM task_checklists tc JOIN tasks t ON tc.task_id = t.id WHERE t.tenant_id = ${tid})`
  );
  await db.delete(taskChecklists).where(eq(taskChecklists.tenantId, tid));
  await db.delete(comments).where(eq(comments.tenantId, tid));
  await db.delete(taskDependencies).where(eq(taskDependencies.tenantId, tid));
  await db.delete(tasks).where(eq(tasks.tenantId, tid));
  await db.delete(phases).where(eq(phases.tenantId, tid));
  await db.delete(projects).where(eq(projects.tenantId, tid));
  await db.delete(tags).where(eq(tags.tenantId, tid));

  // --- Ensure 7 loginable seed users + 1993 bulk users = 2000 total ---
  const seedUserDefs = [
    { email: "alice@demo.com", name: "Alice Chen", role: "site_admin", uid: "DS-ALICE1", password: "Admin@2026" },
    { email: "bob@demo.com", name: "Bob Martinez", role: "pm", uid: "DS-BOB123", password: "BobPM#456" },
    { email: "carol@demo.com", name: "Carol Johnson", role: "developer", uid: "DS-CAROL1", password: "Carol!Dev7" },
    { email: "dave@demo.com", name: "Dave Kim", role: "developer", uid: "DS-DAVE01", password: "DaveK!m89" },
    { email: "eve@demo.com", name: "Eve Williams", role: "developer", uid: "DS-EVE001", password: "EveW!ll01" },
    { email: "frank@demo.com", name: "Frank Lee", role: "client", uid: "DS-FRANK", password: "Frank@Cl1" },
    { email: "grace@demo.com", name: "Grace Patel", role: "client", uid: "DS-GRACE", password: "Grace#Cl2" },
  ];

  // Clean ALL existing users + accounts for this tenant before re-seeding
  const existingUsers = await db.select().from(users).where(eq(users.tenantId, tid));
  for (const u of existingUsers) {
    if (u.accountId) {
      await db.delete(accounts).where(eq(accounts.id, u.accountId)).catch(() => {});
    }
  }
  await db.delete(users).where(eq(users.tenantId, tid));

  // Create the 7 loginable seed users with proper accounts
  for (const def of seedUserDefs) {
    const hash = PASSWORD_HASHES[def.password]!;
    // Clean up any stale account
    await db.delete(accounts).where(eq(accounts.email, def.email)).catch(() => {});

    const [account] = await db.insert(accounts).values({
      uid: def.uid,
      email: def.email,
      passwordHash: hash,
      name: def.name,
    }).returning();

    await db.insert(users).values({
      tenantId: tid,
      accountId: account!.id,
      email: def.email,
      passwordHash: hash,
      name: def.name,
      role: def.role,
    });
  }

  // --- Generate 1993 additional bulk users (total = 2000) ---
  const FIRST_NAMES = [
    "Aaron","Abigail","Adam","Adrian","Aiden","Alejandro","Alex","Alexander","Alexandra","Alexis",
    "Alicia","Allison","Alyssa","Amanda","Amber","Amelia","Amy","Andrea","Andrew","Angela",
    "Anita","Anna","Anthony","Antonio","Aria","Ariana","Arthur","Ashley","Audrey","Austin",
    "Avery","Barbara","Benjamin","Beth","Blake","Bradley","Brandon","Brenda","Brian","Brianna",
    "Brittany","Brooke","Bruce","Bryan","Caleb","Cameron","Carlos","Carmen","Caroline","Carter",
    "Catherine","Chad","Charles","Charlotte","Chase","Chelsea","Cheryl","Christian","Christina","Christine",
    "Christopher","Claire","Claudia","Colin","Connor","Corey","Courtney","Craig","Crystal","Curtis",
    "Cynthia","Dakota","Daniel","Danielle","Darian","David","Dawn","Deborah","Derek","Devin",
    "Diana","Diego","Dominic","Donald","Dorothy","Douglas","Drake","Drew","Duncan","Dylan",
    "Edward","Eleanor","Elena","Eli","Elijah","Elizabeth","Ella","Emily","Emma","Eric",
    "Erica","Erin","Ethan","Eva","Evan","Evelyn","Faith","Fatima","Felix","Fernando",
    "Fiona","Frances","Francisco","Gabriel","Gabriella","Garrett","Gary","Gavin","George","Gerald",
    "Giovanni","Gloria","Grace","Grant","Gregory","Hailey","Hannah","Harold","Harper","Harrison",
    "Hayden","Heather","Henry","Holly","Hunter","Ian","Ingrid","Isaac","Isabella","Ivan",
    "Jack","Jackson","Jacob","James","Jamie","Jane","Janet","Jared","Jasmine","Jason",
    "Javier","Jay","Jayden","Jeffrey","Jennifer","Jeremy","Jesse","Jessica","Jillian","Jimmy",
    "Joanna","Joel","John","Jonathan","Jordan","Jose","Joseph","Joshua","Joyce","Juan",
    "Julia","Julian","Julie","Justin","Kaitlyn","Karen","Katherine","Kathryn","Katie","Keith",
    "Kelly","Kelsey","Kenneth","Kevin","Kimberly","Kyle","Landon","Laura","Lauren","Lawrence",
    "Leah","Leo","Leonard","Leslie","Liam","Lillian","Lily","Linda","Lindsay","Lisa",
    "Logan","Lorena","Lorenzo","Lucas","Lucy","Luke","Luna","Lydia","Mabel","Mackenzie",
    "Madeline","Madison","Manuel","Margaret","Maria","Mariana","Mario","Mark","Marshall","Martha",
    "Martin","Mary","Mason","Matthew","Megan","Melanie","Melissa","Michael","Michelle","Miguel",
    "Mila","Miranda","Mitchell","Mohammed","Molly","Monica","Morgan","Nadia","Nancy","Natalie",
    "Nathan","Nicholas","Nicole","Nina","Noah","Nolan","Nora","Oliver","Olivia","Omar",
    "Oscar","Owen","Paige","Pamela","Patricia","Patrick","Paul","Paula","Penelope","Peter",
    "Philip","Priya","Quinn","Rachel","Rafael","Raj","Ralph","Ramona","Randy","Raymond",
    "Rebecca","Regina","Ricardo","Richard","Riley","Robert","Robin","Roger","Ronald","Rosa",
    "Rose","Russell","Ruth","Ryan","Sabrina","Samantha","Samuel","Sandra","Santiago","Sara",
    "Sarah","Savannah","Scott","Sean","Sebastian","Selena","Shannon","Sharon","Shelby","Sierra",
    "Simon","Sophia","Spencer","Stephanie","Stephen","Steven","Stuart","Susan","Sydney","Sylvia",
    "Tara","Taylor","Teresa","Thomas","Timothy","Todd","Tony","Travis","Trevor","Tristan",
    "Troy","Tyler","Valentina","Valerie","Vanessa","Veronica","Victor","Victoria","Vincent","Virginia",
    "Walter","Wendy","Wesley","Whitney","William","Wyatt","Xavier","Yasmine","Zachary","Zoe",
  ];

  const LAST_NAMES = [
    "Adams","Ali","Allen","Alvarez","Anderson","Armstrong","Bailey","Baker","Barnes","Barrett",
    "Bell","Bennett","Berry","Bishop","Black","Blake","Bowman","Bradley","Brennan","Brooks",
    "Brown","Bryant","Burke","Burns","Butler","Caldwell","Campbell","Carlson","Carpenter","Carroll",
    "Carter","Castillo","Castro","Chambers","Chan","Chang","Chapman","Chen","Cho","Clark",
    "Cole","Coleman","Collins","Cook","Cooper","Cox","Craig","Crawford","Cruz","Cunningham",
    "Curtis","Dalton","Daniels","Das","Davidson","Davis","Day","Dean","Delgado","Diaz",
    "Dixon","Douglas","Dunn","Edwards","Elliott","Ellis","Erickson","Espinoza","Evans","Ferguson",
    "Fernandez","Fields","Fisher","Fletcher","Flores","Ford","Foster","Fox","Francis","Franklin",
    "Freeman","Fuller","Garcia","Gardner","Gibson","Gilbert","Gomez","Gonzalez","Gordon","Graham",
    "Grant","Gray","Green","Griffin","Gross","Gupta","Gutierrez","Hall","Hamilton","Hansen",
    "Harper","Harris","Harrison","Hart","Harvey","Hawkins","Hayes","Henderson","Henry","Hernandez",
    "Herrera","Hill","Ho","Hoffman","Holland","Holmes","Howard","Huang","Hudson","Hughes",
    "Hunt","Hunter","Hussain","Ibrahim","Jackson","Jacobs","James","Jenkins","Jensen","Jimenez",
    "Johnson","Johnston","Jones","Jordan","Joseph","Kang","Kaur","Keller","Kelly","Kennedy",
    "Khan","Kim","King","Knight","Kumar","Lambert","Lane","Larson","Lawrence","Lee",
    "Lewis","Li","Lin","Liu","Long","Lopez","Lowe","Lu","Lynch","Malik",
    "Manning","Marshall","Martin","Martinez","Mason","Matthews","Maxwell","McCarthy","McCoy","McDonald",
    "McKenna","Mendez","Meyer","Miller","Mills","Mitchell","Molina","Montgomery","Moore","Morales",
    "Morgan","Morris","Morrison","Moss","Mullins","Murphy","Murray","Myers","Nakamura","Nash",
    "Neal","Nelson","Newman","Nguyen","Nichols","Nolan","Norris","Obrien","Olson","Ortega",
    "Ortiz","Owen","Owens","Palmer","Park","Parker","Patel","Patterson","Payne","Pearson",
    "Perez","Perry","Peters","Peterson","Phillips","Pierce","Porter","Powell","Price","Quinn",
    "Ramirez","Ramos","Randall","Reed","Reeves","Reid","Reynolds","Rice","Richards","Richardson",
    "Riley","Rivera","Roberts","Robertson","Robinson","Rodriguez","Rogers","Romero","Rose","Ross",
    "Roth","Ruiz","Russell","Ryan","Salazar","Sanchez","Sanders","Santiago","Santos","Sato",
    "Schmidt","Schneider","Scott","Shah","Sharma","Shaw","Shelton","Simmons","Simon","Simpson",
    "Singh","Smith","Snyder","Soto","Spencer","Stephens","Stevens","Stewart","Stone","Sullivan",
    "Summers","Sutton","Suzuki","Swanson","Tanaka","Tate","Taylor","Thomas","Thompson","Thornton",
    "Torres","Tran","Tucker","Turner","Vargas","Vasquez","Vaughn","Vega","Wagner","Walker",
    "Wallace","Walsh","Walters","Wang","Ward","Warren","Washington","Watkins","Watson","Webb",
    "Weber","Wells","West","Wheeler","White","Wilkins","Williams","Willis","Wilson","Wong",
    "Wood","Woods","Wright","Wu","Yang","Young","Zhang","Zimmerman",
  ];

  const DEPARTMENTS = ["Engineering","Product","Design","QA","DevOps","Data","Security","Support","Marketing","Sales"];
  const BULK_ROLES = ["developer","developer","developer","developer","developer","pm","pm","client","client","client"];
  const BULK_PASSWORD_HASH = "$2b$12$L/MHDwV0dsxeBBMkPDh/K./z6uD8pTuy.0.bZe/XYU8Q65VCnGMZC"; // shared hash for bulk users

  const BULK_COUNT = 1993;
  const BATCH_SIZE = 200;
  console.log(`  Creating ${BULK_COUNT} additional users in batches of ${BATCH_SIZE}...`);

  for (let batchStart = 0; batchStart < BULK_COUNT; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, BULK_COUNT);
    const accountValues: Array<{ uid: string; email: string; passwordHash: string; name: string }> = [];
    const userValues: Array<{ tenantId: string; accountId?: string; email: string; passwordHash: string; name: string; role: string }> = [];

    for (let i = batchStart; i < batchEnd; i++) {
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]!;
      // Add a numeric suffix if we exhaust name combos to guarantee uniqueness
      const nameSuffix = Math.floor(i / (FIRST_NAMES.length * LAST_NAMES.length));
      const fullName = nameSuffix > 0 ? `${firstName} ${lastName} ${nameSuffix}` : `${firstName} ${lastName}`;
      const dept = DEPARTMENTS[i % DEPARTMENTS.length]!;
      const emailLocal = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${nameSuffix > 0 ? nameSuffix : ""}`;
      const email = `${emailLocal}@${dept.toLowerCase()}.dynsense.io`;
      const uid = `DS-${String(i + 8).padStart(5, "0")}`;
      const role = BULK_ROLES[i % BULK_ROLES.length]!;

      accountValues.push({ uid, email, passwordHash: BULK_PASSWORD_HASH, name: fullName });
      userValues.push({ tenantId: tid, email, passwordHash: BULK_PASSWORD_HASH, name: fullName, role });
    }

    // Batch insert accounts, then link to users
    const insertedAccounts = await db.insert(accounts).values(accountValues).returning({ id: accounts.id });
    const linkedUserValues = userValues.map((u, idx) => ({
      ...u,
      accountId: insertedAccounts[idx]!.id,
    }));
    await db.insert(users).values(linkedUserValues);

    if ((batchStart / BATCH_SIZE) % 5 === 0) {
      console.log(`    ... ${batchEnd} / ${BULK_COUNT} users created`);
    }
  }

  // Re-fetch all users after creation
  const allUsers = await db.select().from(users).where(eq(users.tenantId, tid)).orderBy(asc(users.createdAt));

  console.log(`  ${allUsers.length} users ready`);

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
  console.log(`  ${insertedTags.length} tags created`);

  // --- Projects ---
  const projectDefs = [
    { name: "Platform Rebuild", description: "Complete rewrite of the core platform using Next.js and Fastify. Includes auth, dashboard, task management, and AI features.", status: "active" },
    { name: "Mobile App", description: "iOS and Android companion app for field consultants. React Native with offline sync capability.", status: "active" },
    { name: "Data Migration", description: "Migrate legacy client data from Oracle to PostgreSQL. ETL pipeline with data validation and rollback support.", status: "active" },
    { name: "Analytics Dashboard", description: "Real-time analytics platform with customizable widgets, drill-down reports, and scheduled PDF exports for stakeholders.", status: "active" },
    { name: "Client Portal", description: "Self-service portal for clients to submit requests, track project progress, view invoices, and communicate with their project team.", status: "active" },
    { name: "DevOps Infrastructure", description: "Infrastructure-as-code initiative to automate provisioning, monitoring, and disaster recovery across all environments.", status: "active" },
  ];
  const insertedProjects = await db.insert(projects).values(
    projectDefs.map((p) => ({ tenantId: tid, ...p }))
  ).returning();
  console.log(`  ${insertedProjects.length} projects created`);

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

    // --- Tasks (varied count per project) ---
    const taskDefsByProject: Record<string, Array<{ title: string; status: string; priority: string; phase: number; effort: string }>> = {
      "Platform Rebuild": [
        { title: "Set up monorepo with Turborepo", status: "completed", priority: "high", phase: 0, effort: "4" },
        { title: "Define PostgreSQL schema and migrations", status: "completed", priority: "high", phase: 0, effort: "8" },
        { title: "Create Figma wireframes for dashboard", status: "completed", priority: "medium", phase: 0, effort: "16" },
        { title: "Write technical design document", status: "completed", priority: "medium", phase: 0, effort: "10" },
        { title: "Implement JWT authentication flow", status: "in_progress", priority: "critical", phase: 1, effort: "24" },
        { title: "Build admin dashboard with charts", status: "in_progress", priority: "high", phase: 1, effort: "20" },
        { title: "Create Fastify REST API routes", status: "in_progress", priority: "high", phase: 1, effort: "32" },
        { title: "Add full-text search with pg_trgm", status: "in_progress", priority: "critical", phase: 1, effort: "12" },
        { title: "Implement S3 file upload service", status: "ready", priority: "high", phase: 1, effort: "16" },
        { title: "Configure GitHub Actions CI/CD", status: "ready", priority: "critical", phase: 1, effort: "8" },
        { title: "Build WebSocket real-time notifications", status: "ready", priority: "medium", phase: 1, effort: "14" },
        { title: "Write Vitest unit test suite", status: "ready", priority: "high", phase: 2, effort: "24" },
        { title: "API integration tests with Supertest", status: "created", priority: "high", phase: 2, effort: "20" },
        { title: "Lighthouse performance audit", status: "created", priority: "low", phase: 2, effort: "16" },
        { title: "OWASP security vulnerability scan", status: "blocked", priority: "critical", phase: 2, effort: "12" },
        { title: "Set up Sentry error monitoring", status: "created", priority: "medium", phase: 2, effort: "6" },
        { title: "Deploy to Vercel staging environment", status: "created", priority: "high", phase: 3, effort: "8" },
        { title: "Production cutover and DNS switch", status: "created", priority: "critical", phase: 3, effort: "4" },
      ],
      "Mobile App": [
        { title: "Initialize React Native project", status: "completed", priority: "high", phase: 0, effort: "4" },
        { title: "Design mobile UI component library", status: "completed", priority: "medium", phase: 0, effort: "12" },
        { title: "Build biometric login screen", status: "in_progress", priority: "critical", phase: 1, effort: "16" },
        { title: "Create task list with pull-to-refresh", status: "in_progress", priority: "medium", phase: 1, effort: "20" },
        { title: "Implement push notification service", status: "in_progress", priority: "high", phase: 1, effort: "24" },
        { title: "Build offline queue with WatermelonDB", status: "blocked", priority: "critical", phase: 1, effort: "32" },
        { title: "Add camera integration for attachments", status: "ready", priority: "low", phase: 1, effort: "12" },
        { title: "Set up Fastlane for automated builds", status: "ready", priority: "medium", phase: 1, effort: "8" },
        { title: "Write Detox end-to-end tests", status: "ready", priority: "low", phase: 2, effort: "24" },
        { title: "App Store and Play Store compliance review", status: "created", priority: "high", phase: 2, effort: "8" },
        { title: "Public app store release", status: "created", priority: "critical", phase: 3, effort: "4" },
      ],
      "Data Migration": [
        { title: "Audit legacy Oracle database schema", status: "completed", priority: "high", phase: 0, effort: "8" },
        { title: "Map Oracle-to-PostgreSQL column types", status: "completed", priority: "medium", phase: 0, effort: "12" },
        { title: "Build ETL pipeline with Node.js streams", status: "in_progress", priority: "critical", phase: 1, effort: "32" },
        { title: "Create data cleansing and dedup scripts", status: "in_progress", priority: "high", phase: 1, effort: "20" },
        { title: "Implement incremental sync for live data", status: "blocked", priority: "critical", phase: 1, effort: "24" },
        { title: "Validate migrated data against source", status: "ready", priority: "medium", phase: 2, effort: "20" },
        { title: "Run full dry-run migration on staging", status: "created", priority: "high", phase: 2, effort: "16" },
        { title: "Client sign-off on data accuracy report", status: "blocked", priority: "critical", phase: 2, effort: "8" },
        { title: "Execute production migration during maintenance window", status: "created", priority: "high", phase: 3, effort: "6" },
      ],
      "Analytics Dashboard": [
        { title: "Gather stakeholder reporting requirements", status: "completed", priority: "high", phase: 0, effort: "6" },
        { title: "Evaluate charting libraries (Recharts vs D3)", status: "completed", priority: "medium", phase: 0, effort: "4" },
        { title: "Design dashboard wireframes and widget grid", status: "completed", priority: "high", phase: 0, effort: "10" },
        { title: "Build drag-and-drop widget layout engine", status: "in_progress", priority: "critical", phase: 1, effort: "28" },
        { title: "Implement time-series chart component", status: "in_progress", priority: "high", phase: 1, effort: "16" },
        { title: "Create data aggregation API endpoints", status: "in_progress", priority: "critical", phase: 1, effort: "20" },
        { title: "Add filter and date-range picker controls", status: "ready", priority: "medium", phase: 1, effort: "12" },
        { title: "Build scheduled PDF export with Puppeteer", status: "ready", priority: "high", phase: 1, effort: "18" },
        { title: "Implement drill-down navigation between charts", status: "ready", priority: "medium", phase: 1, effort: "14" },
        { title: "Add role-based dashboard access controls", status: "created", priority: "high", phase: 2, effort: "10" },
        { title: "Write snapshot tests for chart components", status: "created", priority: "medium", phase: 2, effort: "12" },
        { title: "Load test with 100k data points", status: "created", priority: "high", phase: 2, effort: "8" },
        { title: "Deploy analytics service to production", status: "created", priority: "critical", phase: 3, effort: "6" },
      ],
      "Client Portal": [
        { title: "Define client user stories and acceptance criteria", status: "completed", priority: "high", phase: 0, effort: "8" },
        { title: "Design portal information architecture", status: "completed", priority: "medium", phase: 0, effort: "6" },
        { title: "Build client registration and onboarding flow", status: "in_progress", priority: "critical", phase: 1, effort: "20" },
        { title: "Create project progress timeline view", status: "in_progress", priority: "high", phase: 1, effort: "16" },
        { title: "Implement request submission form with attachments", status: "ready", priority: "high", phase: 1, effort: "14" },
        { title: "Build invoice listing and payment status page", status: "ready", priority: "medium", phase: 1, effort: "12" },
        { title: "Add in-app messaging between client and team", status: "created", priority: "high", phase: 1, effort: "22" },
        { title: "Write integration tests for portal workflows", status: "created", priority: "medium", phase: 2, effort: "16" },
        { title: "Client UAT and feedback round", status: "created", priority: "critical", phase: 2, effort: "8" },
      ],
      "DevOps Infrastructure": [
        { title: "Audit current infrastructure and document topology", status: "completed", priority: "high", phase: 0, effort: "10" },
        { title: "Select IaC tooling (Terraform vs Pulumi)", status: "completed", priority: "medium", phase: 0, effort: "4" },
        { title: "Write Terraform modules for VPC and networking", status: "completed", priority: "critical", phase: 1, effort: "24" },
        { title: "Configure Kubernetes cluster with Helm charts", status: "in_progress", priority: "critical", phase: 1, effort: "32" },
        { title: "Set up Prometheus and Grafana monitoring stack", status: "in_progress", priority: "high", phase: 1, effort: "18" },
        { title: "Implement centralized logging with Loki", status: "in_progress", priority: "medium", phase: 1, effort: "14" },
        { title: "Create automated database backup and restore scripts", status: "ready", priority: "critical", phase: 1, effort: "16" },
        { title: "Build blue-green deployment pipeline", status: "ready", priority: "high", phase: 1, effort: "20" },
        { title: "Configure alerting rules and PagerDuty integration", status: "ready", priority: "high", phase: 2, effort: "10" },
        { title: "Run disaster recovery drill on staging", status: "created", priority: "critical", phase: 2, effort: "12" },
        { title: "Document runbooks for common incident scenarios", status: "created", priority: "medium", phase: 2, effort: "8" },
        { title: "Production infrastructure cutover", status: "created", priority: "critical", phase: 3, effort: "6" },
      ],
    };

    const taskDefs = taskDefsByProject[project.name] ?? taskDefsByProject["Platform Rebuild"]!;

    const insertedTasks = await db.insert(tasks).values(
      taskDefs.map((t, i) => {
        // Spread task creation across the past 7 days so the dashboard chart is populated
        const daysAgo = i % 7;
        const createdAt = new Date(Date.now() - daysAgo * 86400000 + i * 3600000);
        const completedAt = t.status === "completed"
          ? new Date(createdAt.getTime() + (1 + (i % 3)) * 86400000)
          : null;

        return {
          tenantId: tid,
          projectId: project.id,
          phaseId: insertedPhases[t.phase]!.id,
          title: t.title,
          description: `${t.title} for ${project.name}. This task covers all relevant subtasks and deliverables.`,
          status: t.status,
          priority: t.priority,
          sprint: i % 2 === 0 ? "R0" : "R1",
          assigneeId: allUsers[i % allUsers.length]!.id,
          reportedBy: allUsers[(i + 1) % allUsers.length]!.id,
          position: i,
          estimatedEffort: t.effort,
          createdAt,
          dueDate: new Date(Date.now() + (i - (3 + insertedProjects.indexOf(project) * 2)) * 86400000 * 2),
          completedAt,
        };
      })
    ).returning();

    allTasks.push(...insertedTasks.map((t) => ({ id: t.id, projectId: project.id, title: t.title })));

    // --- Task Assignments (multi-assignee on first 8 tasks) ---
    for (let i = 0; i < Math.min(8, insertedTasks.length); i++) {
      const secondAssignee = allUsers[(i + 2) % allUsers.length]!;
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
      // Add second tag to some tasks
      if (i % 3 === 0) {
        const tag2 = insertedTags[(i + 3) % insertedTags.length]!;
        await db.insert(taskTags).values({
          taskId: insertedTasks[i]!.id,
          tagId: tag2.id,
        }).onConflictDoNothing();
      }
    }

    // --- Dependencies (project-specific, fit each project's task count) ---
    const depsByProject: Record<string, Array<[number, number]>> = {
      "Platform Rebuild": [
        [0, 4],   // monorepo setup → JWT auth
        [1, 5],   // DB schema → Fastify API routes
        [4, 11],  // JWT auth → Vitest tests
        [5, 12],  // API routes → integration tests
        [8, 16],  // GitHub Actions CI → deploy staging
        [16, 17], // deploy staging → production cutover
        [6, 7],   // full-text search → S3 upload
      ],
      "Mobile App": [
        [0, 2],  // init project → biometric login
        [1, 3],  // UI library → task list
        [2, 5],  // biometric login → offline queue
        [4, 8],  // push notifications → Detox tests
        [9, 10], // compliance review → app store release
      ],
      "Data Migration": [
        [0, 2],  // audit Oracle → ETL pipeline
        [1, 3],  // column mapping → cleansing scripts
        [2, 4],  // ETL pipeline → incremental sync
        [3, 5],  // cleansing → validate data
        [5, 7],  // validate → client sign-off
        [7, 8],  // client sign-off → production migration
      ],
      "Analytics Dashboard": [
        [0, 2],  // requirements → wireframes
        [2, 3],  // wireframes → widget layout engine
        [5, 4],  // data aggregation API → time-series chart
        [3, 8],  // widget layout → drill-down nav
        [7, 12], // PDF export → deploy
        [10, 11], // snapshot tests → load test
      ],
      "Client Portal": [
        [0, 1],  // user stories → IA design
        [1, 2],  // IA → registration flow
        [2, 3],  // registration → progress timeline
        [4, 7],  // request submission → integration tests
        [7, 8],  // integration tests → client UAT
      ],
      "DevOps Infrastructure": [
        [0, 2],  // audit → Terraform modules
        [1, 2],  // tooling selection → Terraform modules
        [2, 3],  // Terraform → Kubernetes
        [3, 4],  // Kubernetes → Prometheus
        [4, 8],  // Prometheus → alerting rules
        [6, 9],  // backup scripts → DR drill
        [9, 11], // DR drill → production cutover
      ],
    };
    const projectDepDefs = depsByProject[project.name] ?? [];
    const depValues = projectDepDefs
      .filter(([a, b]) => a < insertedTasks.length && b < insertedTasks.length)
      .map(([a, b]) => ({
        tenantId: tid,
        blockerTaskId: insertedTasks[a]!.id,
        blockedTaskId: insertedTasks[b]!.id,
        type: "blocks" as const,
      }));
    if (depValues.length > 0) {
      await db.insert(taskDependencies).values(depValues);
    }

    // --- Comments on first 7 tasks ---
    const commentBodies = [
      "Great progress on this. The implementation looks solid.",
      "Can we schedule a quick review? I have a few suggestions.",
      "This is blocked waiting on the API changes. Let me know when ready.",
      "Updated the approach based on yesterday's discussion. LGTM now.",
      "Found an edge case we need to handle — see linked issue.",
      "Tests are passing. Ready for code review.",
      "Pushed a fix for the regression. Please re-test.",
    ];
    for (let i = 0; i < Math.min(7, insertedTasks.length); i++) {
      const commenter = allUsers[(i + 1) % allUsers.length]!;
      await db.insert(comments).values({
        tenantId: tid,
        taskId: insertedTasks[i]!.id,
        authorId: commenter.id,
        body: commentBodies[i]!,
      });
      // Add a second comment on first 3 tasks
      if (i < 3) {
        const commenter2 = allUsers[(i + 3) % allUsers.length]!;
        await db.insert(comments).values({
          tenantId: tid,
          taskId: insertedTasks[i]!.id,
          authorId: commenter2.id,
          body: `Agreed with the above. Let's finalize "${insertedTasks[i]!.title}" this sprint.`,
        });
      }
    }

    // --- Checklists on first 5 tasks ---
    for (let i = 0; i < Math.min(5, insertedTasks.length); i++) {
      const [checklist] = await db.insert(taskChecklists).values({
        tenantId: tid,
        taskId: insertedTasks[i]!.id,
        title: i < 3 ? "Acceptance Criteria" : "Pre-launch Checklist",
      }).returning();

      const items = i < 3
        ? ["Review requirements", "Write implementation", "Add unit tests", "Update documentation"]
        : ["Code review approved", "QA sign-off", "Performance benchmarks passed", "Security scan clean"];
      const completedCount = i === 0 ? 4 : i === 1 ? 3 : i === 2 ? 2 : i === 3 ? 1 : 0;
      for (let j = 0; j < items.length; j++) {
        await db.insert(checklistItems).values({
          checklistId: checklist!.id,
          label: items[j]!,
          completed: j < completedCount,
          position: j,
        });
      }
    }
  }

  console.log(`  ${allTasks.length} tasks created across ${insertedProjects.length} projects`);

  // --- Recurring Tasks ---
  await db.insert(recurringTaskConfigs).values([
    {
      tenantId: tid,
      projectId: insertedProjects[0]!.id,
      title: "Weekly standup notes",
      description: "Summarize weekly standup discussion points and action items",
      priority: "medium",
      schedule: "weekly",
      cronExpression: "0 9 * * 1",
      enabled: true,
      createdBy: allUsers[1]?.id ?? allUsers[0]!.id,
    },
    {
      tenantId: tid,
      projectId: insertedProjects[0]!.id,
      title: "Monthly security review",
      description: "Review security logs, update dependencies, and run vulnerability scans",
      priority: "high",
      schedule: "monthly",
      cronExpression: "0 10 1 * *",
      enabled: true,
      createdBy: allUsers[0]!.id,
    },
    {
      tenantId: tid,
      projectId: insertedProjects[1]!.id,
      title: "Sprint retrospective",
      description: "Bi-weekly sprint retrospective and velocity review",
      priority: "medium",
      schedule: "weekly",
      cronExpression: "0 15 * * 5",
      enabled: true,
      createdBy: allUsers[1]?.id ?? allUsers[0]!.id,
    },
  ]);
  console.log("  3 recurring task configs created");

  // --- Reminders ---
  for (let i = 0; i < Math.min(6, allTasks.length); i++) {
    await db.insert(taskReminders).values({
      tenantId: tid,
      taskId: allTasks[i]!.id,
      userId: allUsers[i % allUsers.length]!.id,
      remindAt: new Date(Date.now() + (i + 1) * 86400000),
      channel: i % 3 === 0 ? "email" : "in_app",
    });
  }
  console.log("  6 task reminders created");

  // --- Notifications for ALL users ---
  const notifTemplates = [
    { type: "task_assigned", title: "New task assigned", body: "You've been assigned 'Build dashboard UI' on Platform Rebuild" },
    { type: "comment_added", title: "New comment", body: "Someone commented on 'Create REST API endpoints'" },
    { type: "task_status", title: "Task completed", body: "'Set up project repository' was marked as completed" },
    { type: "mention", title: "You were mentioned", body: "You were mentioned in a comment on 'Implement search functionality'" },
    { type: "deadline", title: "Deadline approaching", body: "'Security audit' is due in 2 days" },
    { type: "task_assigned", title: "Task reassigned", body: "'Performance optimization' has been reassigned to you" },
    { type: "comment_added", title: "Reply to your comment", body: "Someone replied to your comment on 'Define database schema'" },
    { type: "task_status", title: "Task moved to In Progress", body: "'Write unit tests' was moved to In Progress" },
  ];

  const notifValues: Array<{
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
  }> = [];

  for (const user of allUsers) {
    for (const tmpl of notifTemplates) {
      notifValues.push({
        tenantId: tid,
        userId: user.id,
        type: tmpl.type,
        title: tmpl.title,
        body: tmpl.body,
      });
    }
  }
  const NOTIF_BATCH = 500;
  for (let i = 0; i < notifValues.length; i += NOTIF_BATCH) {
    await db.insert(notifications).values(notifValues.slice(i, i + NOTIF_BATCH));
  }
  console.log(`  ${notifValues.length} notifications created (${notifTemplates.length} per user)`);

  // --- Audit log entries ---
  const auditEntries = [
    { actorId: allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[0]!.id },
    { actorId: allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[1]!.id },
    { actorId: allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[2]!.id },
    { actorId: allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[3]!.id },
    { actorId: allUsers[1]?.id ?? allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[4]!.id },
    { actorId: allUsers[1]?.id ?? allUsers[0]!.id, action: "project.created", entityType: "project", entityId: insertedProjects[5]!.id },
    { actorId: allUsers[1]?.id ?? allUsers[0]!.id, action: "task.created", entityType: "task", entityId: allTasks[0]!.id },
    { actorId: allUsers[1]?.id ?? allUsers[0]!.id, action: "task.created", entityType: "task", entityId: allTasks[5]!.id },
    { actorId: allUsers[2]?.id ?? allUsers[0]!.id, action: "task.status_changed", entityType: "task", entityId: allTasks[3]!.id, diff: { field: "status", from: "in_progress", to: "completed" } },
    { actorId: allUsers[2]?.id ?? allUsers[0]!.id, action: "task.status_changed", entityType: "task", entityId: allTasks[0]!.id, diff: { field: "status", from: "ready", to: "completed" } },
    { actorId: allUsers[3]?.id ?? allUsers[0]!.id, action: "comment.created", entityType: "comment", entityId: allTasks[1]!.id },
    { actorId: allUsers[0]!.id, action: "user.invited", entityType: "user", entityId: allUsers[allUsers.length - 1]!.id },
  ];
  await db.insert(auditLog).values(
    auditEntries.map((e) => ({
      tenantId: tid,
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      diff: "diff" in e ? e.diff : null,
    }))
  );
  console.log(`  ${auditEntries.length} audit log entries created`);

  console.log("\nSeed complete!");
  console.log(`  Tenant: ${existingTenant.name} (${tid})`);
  console.log(`  ${allUsers.length} users`);
  console.log("  Login credentials:");
  for (const def of seedUserDefs) {
    console.log(`    ${def.name} | UID: ${def.uid} | Email: ${def.email} | Password: ${def.password}`);
  }
  console.log(`  ${insertedTags.length} tags`);
  console.log(`  ${insertedProjects.length} projects, ${insertedProjects.length * 4} phases, ${allTasks.length} tasks`);
  console.log("  Comments, checklists, dependencies, assignments, notifications, reminders, audit log");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
