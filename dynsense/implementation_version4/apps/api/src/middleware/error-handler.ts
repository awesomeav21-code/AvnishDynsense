// Ref: design-doc §3.3 — Global error handler: AppError, Zod validation, 500 fallback
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code ?? "APP_ERROR",
      message: error.message,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: error.flatten().fieldErrors,
    });
  }

  // 500 fallback — show real error in development
  console.error("Unhandled error:", error);
  const isDev = process.env.NODE_ENV !== "production";
  return reply.status(500).send({
    error: "INTERNAL_ERROR",
    message: isDev ? String(error.message || error) : "An unexpected error occurred",
    ...(isDev && { stack: error.stack }),
  });
}
