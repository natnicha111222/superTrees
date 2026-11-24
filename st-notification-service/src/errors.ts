import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** error ที่ services โยน → middleware แปลงเป็น { code, message, details? } */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `ไม่พบ${what}`);
