// ตรวจผู้ใช้ — service ต้องตรวจ JWT เองเสมอ ไม่เชื่อ Kong อย่างเดียว (CLAUDE.md)
// ⏳ การตรวจ JWT ของ Supabase จริงรอ CONF-002 (TASK-003) — ตอนนี้มี 2 โหมด:
//   disabled       → 503 AUTH_NOT_CONFIGURED (ค่าเริ่มต้น)
//   dev-fixed-user → MOCK-002: ทุก request = DEV_USER_ID · config.ts บังคับให้ใช้ได้เฉพาะ APP_ENV=local
import { createMiddleware } from 'hono/factory';
import type { Config } from '../config';
import { AppError } from '../errors';

export interface AuthUser {
  id: string;
  role: 'user' | 'admin';
}

export type AuthEnv = { Variables: { user: AuthUser; requestId: string } };

export function requireAuth(config: Config) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (config.AUTH_MODE === 'dev-fixed-user') {
      c.set('user', { id: config.DEV_USER_ID, role: 'user' }); // MOCK-002
      return next();
    }
    throw new AppError(503, 'AUTH_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่าการยืนยันตัวตน (CONF-002)');
  });
}
