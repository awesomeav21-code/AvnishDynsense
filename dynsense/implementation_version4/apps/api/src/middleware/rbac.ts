import type { FastifyRequest, FastifyReply } from "fastify";
import { ROLE_PERMISSIONS, type Permission } from "@dynsense/shared";
import type { Role } from "@dynsense/shared";
import { AppError } from "../utils/errors.js";

export function requirePermission(...permissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const { role } = request.jwtPayload;
    const userPermissions = ROLE_PERMISSIONS[role as Role] ?? [];
    const hasAll = permissions.every((p) => userPermissions.includes(p));
    if (!hasAll) {
      throw AppError.forbidden(`Missing permission: ${permissions.join(", ")}`);
    }
  };
}
