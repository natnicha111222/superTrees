import type { ApiError } from '@supertrees/contracts';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError } from '../errors';

// ไม่ส่ง stack trace / SQL ออกไป (CODE_STANDARDS 18)
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json<ApiError>({ code: err.code, message: err.message, details: err.details }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json<ApiError>(
      { code: 'VALIDATION_ERROR', message: 'ข้อมูลไม่ถูกต้อง', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      400,
    );
  }
  if (err instanceof HTTPException) {
    return c.json<ApiError>({ code: 'HTTP_ERROR', message: err.message }, err.status);
  }
  console.error(`[${c.get('requestId') ?? '-'}]`, err);
  return c.json<ApiError>({ code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายใน' }, 500);
}

export function notFoundHandler(c: Context) {
  return c.json<ApiError>({ code: 'NOT_FOUND', message: 'ไม่พบเส้นทางนี้' }, 404);
}
