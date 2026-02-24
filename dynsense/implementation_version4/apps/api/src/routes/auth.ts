import type { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { users, tenants } from "@dynsense/db";
import { loginSchema, refreshTokenSchema } from "@dynsense/shared";
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

  // POST /register
  app.post("/register", async (request, reply) => {
    const body = localRegisterSchema.parse(request.body);

    // Generate slug from workspace name
    const slug = body.workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug) throw AppError.badRequest("Invalid workspace name");

    // Check if workspace slug already exists
    const existingTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (existingTenant) throw AppError.conflict("Workspace name is already taken");

    // Create the workspace
    const [created] = await db.insert(tenants).values({
      name: body.workspaceName,
      slug,
      planTier: "starter",
    }).returning();
    const tenantId = created!.id;

    // Check duplicate email within tenant
    const existing = await db.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.email, body.email)),
    });
    if (existing) throw AppError.conflict("Email already registered in this tenant");

    const passwordHash = await bcrypt.hash(body.password, 12);

    const [user] = await db.insert(users).values({
      tenantId,
      email: body.email,
      passwordHash,
      name: body.name,
      role: "site_admin",
    }).returning();

    if (!user) throw AppError.badRequest("Failed to create user");

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload["role"],
    };

    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY });
    const refreshToken = app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY });

    // Store refresh token
    await db.update(users).set({ refreshToken }).where(eq(users.id, user.id));

    reply.status(201).send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
    });
  });

  // POST /login
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    // Resolve workspace slug to tenant
    const slug = body.workspace
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (!tenant) throw AppError.unauthorized("Invalid workspace, email, or password");

    // Find user within the specified workspace
    const user = await db.query.users.findFirst({
      where: and(eq(users.tenantId, tenant.id), eq(users.email, body.email)),
    });
    if (!user) throw AppError.unauthorized("Invalid workspace, email, or password");

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!validPassword) throw AppError.unauthorized("Invalid email or password");

    if (user.status !== "active") throw AppError.forbidden("Account is not active");

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload["role"],
    };

    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY });
    const refreshToken = app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY });

    await db.update(users).set({ refreshToken }).where(eq(users.id, user.id));

    reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
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

    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload["role"],
    };

    const accessToken = app.jwt.sign(payload, { expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY });
    const refreshToken = app.jwt.sign(payload, { expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY });

    await db.update(users).set({ refreshToken }).where(eq(users.id, user.id));

    reply.send({ accessToken, refreshToken });
  });

  // GET /me
  app.get("/me", { preHandler: [authenticate] }, async (request) => {
    const { sub } = request.jwtPayload;

    const user = await db.query.users.findFirst({
      where: eq(users.id, sub),
    });
    if (!user) throw AppError.notFound("User not found");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };
  });

  // POST /logout
  app.post("/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const { sub } = request.jwtPayload;
    await db.update(users).set({ refreshToken: null }).where(eq(users.id, sub));
    reply.send({ message: "Logged out" });
  });
}
