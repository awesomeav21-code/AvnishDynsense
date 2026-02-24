import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { users, tenants, accounts } from "@dynsense/db";
import { loginSchema, loginStep1Schema, loginStep2Schema, switchWorkspaceSchema, refreshTokenSchema } from "@dynsense/shared";
import { z } from "zod";
import type { JwtPayload } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";

export async function authRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  // Local register schema
  const localRegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(1).max(255),
    workspaceName: z.string().min(1).max(100),
  });

  // Helper: build JWT payload and issue tokens
  async function issueTokens(membership: { id: string; tenantId: string; role: string }, accountId: string) {
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: membership.id,
      accountId,
      tenantId: membership.tenantId,
      role: membership.role as JwtPayload["role"],
    };
    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY });
    const refreshToken = app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY });
    await db.update(users).set({ refreshToken }).where(eq(users.id, membership.id));
    return { accessToken, refreshToken };
  }

  // Helper: fetch all active workspace memberships for an account
  async function getWorkspaces(accountId: string) {
    return db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        userId: users.id,
        role: users.role,
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(and(eq(users.accountId, accountId), eq(users.status, "active")));
  }

  // POST /register — create new workspace (links to existing account if email exists)
  app.post("/register", async (request, reply) => {
    const body = localRegisterSchema.parse(request.body);

    const slug = body.workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) throw AppError.badRequest("Invalid workspace name");

    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (existingTenant) throw AppError.conflict("Workspace name is already taken");

    // Check for existing global account
    let account = await db.query.accounts.findFirst({
      where: eq(accounts.email, body.email),
    });

    if (account) {
      // Existing identity — verify password
      const valid = await bcrypt.compare(body.password, account.passwordHash);
      if (!valid) throw AppError.unauthorized("An account with this email already exists. Please enter your existing password to create a new workspace.");
    } else {
      // New identity
      const passwordHash = await bcrypt.hash(body.password, 12);
      const [created] = await db.insert(accounts).values({
        email: body.email,
        passwordHash,
        name: body.name,
      }).returning();
      account = created!;
    }

    // Create workspace
    const [tenant] = await db.insert(tenants).values({
      name: body.workspaceName,
      slug,
      planTier: "starter",
    }).returning();
    const tenantId = tenant!.id;

    // Create membership
    const [membership] = await db.insert(users).values({
      tenantId,
      accountId: account.id,
      email: account.email,
      passwordHash: account.passwordHash,
      name: account.name,
      role: "site_admin",
    }).returning();

    if (!membership) throw AppError.badRequest("Failed to create user");

    const tokens = await issueTokens(membership, account.id);

    reply.status(201).send({
      ...tokens,
      user: { id: membership.id, accountId: account.id, email: account.email, name: account.name, role: membership.role, tenantId },
    });
  });

  // POST /login/identify — step 1: verify credentials, return workspace list
  app.post("/login/identify", async (request, reply) => {
    const body = loginStep1Schema.parse(request.body);

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.email, body.email),
    });
    if (!account) throw AppError.unauthorized("Invalid email or password");

    const valid = await bcrypt.compare(body.password, account.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid email or password");

    const workspaces = await getWorkspaces(account.id);

    if (workspaces.length === 0) {
      throw AppError.unauthorized("No active workspaces found for this account");
    }

    // Single workspace — auto-login for convenience
    if (workspaces.length === 1) {
      const m = workspaces[0]!;
      const tokens = await issueTokens({ id: m.userId, tenantId: m.tenantId, role: m.role }, account.id);

      return reply.send({
        requiresWorkspaceSelection: false,
        ...tokens,
        user: { id: m.userId, accountId: account.id, email: account.email, name: account.name, role: m.role, tenantId: m.tenantId },
        workspaces: workspaces.map((w) => ({
          tenantId: w.tenantId,
          tenantName: w.tenantName,
          tenantSlug: w.tenantSlug,
          userId: w.userId,
          role: w.role,
        })),
      });
    }

    // Multiple workspaces — return list for picker
    reply.send({
      requiresWorkspaceSelection: true,
      workspaces: workspaces.map((w) => ({
        tenantId: w.tenantId,
        tenantName: w.tenantName,
        tenantSlug: w.tenantSlug,
        userId: w.userId,
        role: w.role,
      })),
    });
  });

  // POST /login/select — step 2: pick workspace, get tokens
  app.post("/login/select", async (request, reply) => {
    const body = loginStep2Schema.parse(request.body);

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.email, body.email),
    });
    if (!account) throw AppError.unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(body.password, account.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid credentials");

    const membership = await db.query.users.findFirst({
      where: and(eq(users.accountId, account.id), eq(users.tenantId, body.tenantId), eq(users.status, "active")),
    });
    if (!membership) throw AppError.unauthorized("Not a member of this workspace");

    const tokens = await issueTokens(membership, account.id);

    reply.send({
      ...tokens,
      user: { id: membership.id, accountId: account.id, email: account.email, name: account.name, role: membership.role, tenantId: membership.tenantId },
    });
  });

  // POST /login — login with workspace slug
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const slug = body.workspace
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Look up all memberships for this email to validate workspace
    const allMemberships = await db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        tenantId: tenants.id,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(eq(users.email, body.email));

    if (allMemberships.length === 0) {
      throw AppError.unauthorized("Invalid workspace, email, or password");
    }

    // Verify password against the first membership found
    const validPassword = await bcrypt.compare(body.password, allMemberships[0]!.passwordHash);
    if (!validPassword) throw AppError.unauthorized("Invalid workspace, email, or password");

    // Find the matching workspace by slug or by name (case-insensitive)
    const trimmed = body.workspace.trim().toLowerCase();
    const membership = allMemberships.find(
      (m) => m.tenantSlug === slug || m.tenantName.toLowerCase() === trimmed,
    );

    if (!membership) {
      const userName = allMemberships[0]!.name;
      const workspaceNames = allMemberships.map((m) => m.tenantName);
      throw AppError.unauthorized(
        `No workspace "${body.workspace}" found for ${userName}. Your workspaces: ${workspaceNames.join(", ")}`,
      );
    }

    if (membership.status !== "active") throw AppError.forbidden("Account is not active");

    const tokens = await issueTokens(
      { id: membership.userId, tenantId: membership.tenantId, role: membership.role },
      membership.userId,
    );

    reply.send({
      ...tokens,
      user: { id: membership.userId, email: membership.email, name: membership.name, role: membership.role, tenantId: membership.tenantId },
    });
  });

  // POST /switch-workspace — switch to a different workspace (authenticated)
  app.post("/switch-workspace", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub, accountId } = request.jwtPayload;
    const body = switchWorkspaceSchema.parse(request.body);

    // Resolve accountId: from JWT if present, otherwise look up from current user
    let resolvedAccountId = accountId;
    if (!resolvedAccountId) {
      const currentUser = await db.query.users.findFirst({ where: eq(users.id, sub) });
      resolvedAccountId = currentUser?.accountId ?? undefined;
    }
    if (!resolvedAccountId) throw AppError.badRequest("Account not linked — please log in again");

    const membership = await db.query.users.findFirst({
      where: and(
        eq(users.accountId, resolvedAccountId),
        eq(users.tenantId, body.tenantId),
        eq(users.status, "active"),
      ),
    });
    if (!membership) throw AppError.forbidden("Not a member of this workspace");

    const account = await db.query.accounts.findFirst({ where: eq(accounts.id, resolvedAccountId) });
    if (!account) throw AppError.notFound("Account not found");

    const tokens = await issueTokens(membership, account.id);

    reply.send({
      ...tokens,
      user: { id: membership.id, accountId: account.id, email: account.email, name: account.name, role: membership.role, tenantId: body.tenantId },
    });
  });

  // POST /refresh
  app.post("/refresh", async (request, reply) => {
    const body = refreshTokenSchema.parse(request.body);

    let decoded: JwtPayload;
    try {
      decoded = app.jwt.verify<JwtPayload>(body.refreshToken);
    } catch {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.sub),
    });
    if (!user || user.refreshToken !== body.refreshToken) {
      throw AppError.unauthorized("Invalid refresh token");
    }

    const tokens = await issueTokens(user, decoded.accountId ?? user.accountId ?? user.id);

    reply.send(tokens);
  });

  // GET /me — returns user profile + list of workspaces
  app.get("/me", { preHandler: [authenticate] }, async (request) => {
    const { sub, accountId } = request.jwtPayload;

    const user = await db.query.users.findFirst({
      where: eq(users.id, sub),
    });
    if (!user) throw AppError.notFound("User not found");

    // Resolve account and workspaces (gracefully handle missing accounts table / account_id column)
    const resolvedAccountId = accountId ?? user.accountId;
    let workspaces: Array<{ tenantId: string; tenantName: string; tenantSlug: string; userId: string; role: string }> = [];

    if (resolvedAccountId) {
      try {
        workspaces = await getWorkspaces(resolvedAccountId);
      } catch {
        // accounts table or account_id column may not exist yet — fall through to single-workspace fallback
      }
    }

    // If no workspaces found (pre-migration user or query failed), return current workspace only
    if (workspaces.length === 0) {
      const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, user.tenantId) });
      workspaces = [{
        tenantId: user.tenantId,
        tenantName: tenant?.name ?? "Workspace",
        tenantSlug: tenant?.slug ?? "default",
        userId: user.id,
        role: user.role,
      }];
    }

    return {
      id: user.id,
      accountId: resolvedAccountId,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      workspaces,
    };
  });

  // POST /logout
  app.post("/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub } = request.jwtPayload;
    await db.update(users).set({ refreshToken: null }).where(eq(users.id, sub));
    reply.send({ message: "Logged out" });
  });
}
