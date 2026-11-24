// อ่าน env + validate (ไม่มีค่า default ของค่าลับ — CLAUDE.md)
import { z } from 'zod';

const schema = z
  .object({
    APP_ENV: z.enum(['local', 'dev', 'uat', 'prod']).default('local'),
    PORT: z.coerce.number().int().default(3003),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.string().min(1),
    SUPABASE_URL: z.url(),
    /** URL ที่เบราว์เซอร์ใช้เรียก Storage (signed URL) — ไม่ระบุ = SUPABASE_URL */
    SUPABASE_PUBLIC_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    RABBITMQ_URL: z.string().optional(),
    /**
     * disabled = เส้นที่ต้อง login ตอบ 503 (ค่าเริ่มต้น — รอ CONF-002)
     * dev-fixed-user = MOCK-002: ทุก request เป็นผู้ใช้ DEV_USER_ID (ใช้ได้เฉพาะ APP_ENV=local)
     */
    AUTH_MODE: z.enum(['disabled', 'dev-fixed-user']).default('disabled'),
    DEV_USER_ID: z.uuid().default('00000000-0000-4000-8000-000000000001'),
  })
  .refine((c) => c.AUTH_MODE !== 'dev-fixed-user' || c.APP_ENV === 'local', {
    message: 'AUTH_MODE=dev-fixed-user ใช้ได้เฉพาะ APP_ENV=local',
    path: ['AUTH_MODE'],
  });

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // บอกแค่ชื่อตัวแปรที่ผิด ไม่พิมพ์ค่า (อาจเป็นค่าลับ)
    const fields = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`env ไม่ครบ/ไม่ถูกต้อง (ดู .env.example):\n  ${fields}`);
  }
  return parsed.data;
}
