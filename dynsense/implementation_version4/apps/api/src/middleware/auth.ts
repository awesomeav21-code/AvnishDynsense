import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@dynsense/shared";

declare module "fastify" {
  interface FastifyRequest {
    jwtPayload: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<JwtPayload>();
    request.jwtPayload = decoded;
  } catch {
    reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}
