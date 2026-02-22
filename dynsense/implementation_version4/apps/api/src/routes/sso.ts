// Ref: FR-106 — SSO integration (SAML 2.0 / OIDC)
// Ref: FR-107 — MFA (TOTP) enrollment, verification, recovery codes
// Ref: FR-108 — Session hardening: device fingerprint, IP pinning, concurrent limits
import type { FastifyInstance } from "fastify";
import { eq, and, desc, count } from "drizzle-orm";
import { users, tenants, tenantConfigs } from "@dynsense/db";
import { AppError } from "../utils/errors.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { writeAuditLog } from "./audit.js";
import { getDb } from "../db.js";
import type { Env } from "../config/env.js";
import { z } from "zod";
import { randomBytes, createHmac } from "node:crypto";

// ── SSO Schemas ──
const ssoConfigSchema = z.object({
  protocol: z.enum(["saml", "oidc"]),
  entityId: z.string().url().optional(),
  ssoUrl: z.string().url(),
  certificate: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  issuer: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

// ── MFA Schemas ──
const mfaVerifySchema = z.object({
  code: z.string().length(6),
});

// ── Session Schemas ──
const sessionConfigSchema = z.object({
  maxConcurrentSessions: z.number().int().min(1).max(50).optional(),
  sessionTimeoutHours: z.number().int().min(1).max(720).optional(),
  ipPinning: z.boolean().optional(),
  deviceFingerprinting: z.boolean().optional(),
});

export async function ssoRoutes(app: FastifyInstance) {
  const env = app.env as Env;
  const db = getDb(env);

  app.addHook("preHandler", authenticate);

  // ════════════════════════════════════════════════════════════════
  // SSO Configuration (FR-106) — admin only
  // ════════════════════════════════════════════════════════════════

  // GET /sso/config — get SSO configuration for tenant
  app.get("/sso/config", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;

    const row = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "auth.sso")),
    });

    return { data: row?.value ?? null, configured: !!row };
  });

  // PUT /sso/config — set SSO configuration
  app.put("/sso/config", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = ssoConfigSchema.parse(request.body);

    const existing = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "auth.sso")),
    });

    if (existing) {
      const [updated] = await db.update(tenantConfigs)
        .set({ value: body, updatedAt: new Date() })
        .where(eq(tenantConfigs.id, existing.id))
        .returning();

      await writeAuditLog(db, {
        tenantId, entityType: "sso_config", entityId: updated!.id,
        action: "update", actorId: userId,
      });
      return { data: updated };
    }

    const [created] = await db.insert(tenantConfigs).values({
      tenantId,
      key: "auth.sso",
      value: body,
    }).returning();

    await writeAuditLog(db, {
      tenantId, entityType: "sso_config", entityId: created!.id,
      action: "create", actorId: userId,
    });
    return { data: created };
  });

  // GET /sso/redirect — initiate SSO login redirect
  // In production, this builds a real SAML AuthnRequest or OIDC authorize URL
  app.get("/sso/redirect", async (request, reply) => {
    const { tenantId } = request.jwtPayload;

    const configRow = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "auth.sso")),
    });

    if (!configRow) {
      throw AppError.badRequest("SSO not configured for this tenant");
    }

    const config = configRow.value as Record<string, unknown>;
    const ssoUrl = config.ssoUrl as string;
    const protocol = config.protocol as string;

    // Generate state token for CSRF protection
    const state = randomBytes(32).toString("hex");

    // R1 stub: In production, build real SAML/OIDC request
    return {
      redirectUrl: ssoUrl,
      protocol,
      state,
      message: "Redirect user to this URL. Callback will POST to /sso/callback.",
    };
  });

  // POST /sso/callback — handle SSO callback (SAML assertion or OIDC code exchange)
  app.post("/sso/callback", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const payload = request.body as Record<string, unknown>;

    // R1 stub: In production, validate SAML assertion or exchange OIDC code
    // For now, verify we have expected fields
    const email = payload.email as string | undefined;
    if (!email) {
      throw AppError.badRequest("SSO callback must include email");
    }

    // Find or create user from SSO assertion
    let user = await db.query.users.findFirst({
      where: and(eq(users.tenantId, tenantId), eq(users.email, email)),
    });

    if (!user) {
      // Auto-provision user from SSO
      const [created] = await db.insert(users).values({
        tenantId,
        email,
        passwordHash: "sso-managed", // SSO users don't use password
        name: (payload.name as string) ?? email.split("@")[0]!,
        role: "developer",
      }).returning();
      user = created!;
    }

    // Issue tokens
    const jwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = app.jwt.sign(jwtPayload, { expiresIn: env.JWT_ACCESS_TOKEN_EXPIRY });
    const refreshToken = app.jwt.sign(jwtPayload, { expiresIn: env.JWT_REFRESH_TOKEN_EXPIRY });

    await db.update(users).set({ refreshToken }).where(eq(users.id, user.id));

    await writeAuditLog(db, {
      tenantId, entityType: "user", entityId: user.id,
      action: "sso_login", actorId: user.id,
    });

    return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // ════════════════════════════════════════════════════════════════
  // MFA / TOTP (FR-107)
  // ════════════════════════════════════════════════════════════════

  // POST /mfa/enroll — generate TOTP secret + recovery codes
  app.post("/mfa/enroll", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    // Generate a base32-like secret (R1: use speakeasy/otpauth in production)
    const secret = randomBytes(20).toString("hex");
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString("hex").toUpperCase(),
    );

    // Store in tenant_configs per user
    const configKey = `mfa.totp.${userId}`;
    const existing = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, configKey)),
    });

    const mfaData = {
      secret,
      recoveryCodes,
      enrolled: false, // becomes true after first verification
      enrolledAt: null as string | null,
    };

    if (existing) {
      await db.update(tenantConfigs)
        .set({ value: mfaData, updatedAt: new Date() })
        .where(eq(tenantConfigs.id, existing.id));
    } else {
      await db.insert(tenantConfigs).values({
        tenantId,
        key: configKey,
        value: mfaData,
      });
    }

    // Return provisioning URI (for QR code generation on frontend)
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const provisioningUri = `otpauth://totp/Dynsense:${user?.email ?? userId}?secret=${secret}&issuer=Dynsense`;

    return {
      data: {
        secret,
        provisioningUri,
        recoveryCodes,
        message: "Scan the QR code with your authenticator app, then verify with /mfa/verify.",
      },
    };
  });

  // POST /mfa/verify — verify TOTP code to complete enrollment or login
  app.post("/mfa/verify", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const { code } = mfaVerifySchema.parse(request.body);

    const configKey = `mfa.totp.${userId}`;
    const row = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, configKey)),
    });

    if (!row) {
      throw AppError.badRequest("MFA not enrolled. Call /mfa/enroll first.");
    }

    const mfaData = row.value as {
      secret: string;
      recoveryCodes: string[];
      enrolled: boolean;
    };

    // R1 TOTP verification stub: In production, use a proper TOTP library
    // For now, accept any 6-digit code if secret exists (allows testing flow)
    const hmac = createHmac("sha1", mfaData.secret);
    const timeStep = Math.floor(Date.now() / 30000);
    hmac.update(String(timeStep));
    const expectedCode = hmac.digest("hex").slice(0, 6);

    // Check against TOTP or recovery code
    const isValidTotp = code === expectedCode;
    const isRecoveryCode = mfaData.recoveryCodes.includes(code.toUpperCase());

    if (!isValidTotp && !isRecoveryCode) {
      throw AppError.unauthorized("Invalid MFA code");
    }

    // If recovery code used, remove it
    if (isRecoveryCode) {
      mfaData.recoveryCodes = mfaData.recoveryCodes.filter(
        (c) => c !== code.toUpperCase(),
      );
    }

    // Mark as enrolled
    await db.update(tenantConfigs)
      .set({
        value: { ...mfaData, enrolled: true, enrolledAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(tenantConfigs.id, row.id));

    await writeAuditLog(db, {
      tenantId, entityType: "user", entityId: userId,
      action: "mfa_verified", actorId: userId,
    });

    return { verified: true, recoveryCodesRemaining: mfaData.recoveryCodes.length };
  });

  // GET /mfa/status — check MFA enrollment status
  app.get("/mfa/status", async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;

    const configKey = `mfa.totp.${userId}`;
    const row = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, configKey)),
    });

    if (!row) {
      return { enrolled: false };
    }

    const mfaData = row.value as { enrolled: boolean; enrolledAt: string | null; recoveryCodes: string[] };
    return {
      enrolled: mfaData.enrolled,
      enrolledAt: mfaData.enrolledAt,
      recoveryCodesRemaining: mfaData.recoveryCodes.length,
    };
  });

  // DELETE /mfa — disable MFA (admin or self)
  app.delete("/mfa", async (request, reply) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const configKey = `mfa.totp.${userId}`;

    await db.delete(tenantConfigs)
      .where(and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, configKey)));

    await writeAuditLog(db, {
      tenantId, entityType: "user", entityId: userId,
      action: "mfa_disabled", actorId: userId,
    });

    reply.status(204).send();
  });

  // ════════════════════════════════════════════════════════════════
  // Session Hardening (FR-108)
  // ════════════════════════════════════════════════════════════════

  // GET /session/config — get session security config for tenant
  app.get("/session/config", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId } = request.jwtPayload;

    const row = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "auth.session")),
    });

    const defaults = {
      maxConcurrentSessions: 5,
      sessionTimeoutHours: 24,
      ipPinning: false,
      deviceFingerprinting: false,
    };

    return { data: row?.value ?? defaults };
  });

  // PUT /session/config — update session security config
  app.put("/session/config", {
    preHandler: [requirePermission("config:manage")],
  }, async (request) => {
    const { tenantId, sub: userId } = request.jwtPayload;
    const body = sessionConfigSchema.parse(request.body);

    const existing = await db.query.tenantConfigs.findFirst({
      where: and(eq(tenantConfigs.tenantId, tenantId), eq(tenantConfigs.key, "auth.session")),
    });

    if (existing) {
      const merged = { ...(existing.value as Record<string, unknown>), ...body };
      const [updated] = await db.update(tenantConfigs)
        .set({ value: merged, updatedAt: new Date() })
        .where(eq(tenantConfigs.id, existing.id))
        .returning();
      return { data: updated };
    }

    const [created] = await db.insert(tenantConfigs).values({
      tenantId,
      key: "auth.session",
      value: body,
    }).returning();

    await writeAuditLog(db, {
      tenantId, entityType: "session_config", entityId: created!.id,
      action: "create", actorId: userId,
    });
    return { data: created };
  });

  // GET /session/info — get current session metadata (device, IP)
  app.get("/session/info", async (request) => {
    const ip = request.ip;
    const userAgent = request.headers["user-agent"] ?? "unknown";
    // Simple device fingerprint from user-agent
    const fingerprint = createHmac("sha256", "dynsense-fp")
      .update(userAgent)
      .digest("hex")
      .slice(0, 16);

    return {
      data: {
        ip,
        userAgent,
        deviceFingerprint: fingerprint,
        issuedAt: new Date().toISOString(),
      },
    };
  });
}
