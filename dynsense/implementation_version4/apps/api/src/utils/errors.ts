// Ref: design-doc §3.3 — Global error handler (AppError, Zod validation, 500 fallback)

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, code?: string) {
    return new AppError(400, message, code);
  }

  static unauthorized(message = "Unauthorized") {
    return new AppError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden") {
    return new AppError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Not found") {
    return new AppError(404, message, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new AppError(409, message, "CONFLICT");
  }
}
