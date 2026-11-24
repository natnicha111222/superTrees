// schema `listing` — เจ้าของคือ st-listing-service เท่านั้น (ห้าม service อื่น query)
// ตารางจริงมาใน TASK ของโดเมน · เปลี่ยนแล้วต้อง `bun run db:generate` ได้ไฟล์ migration ใหม่เสมอ
import { pgSchema } from 'drizzle-orm/pg-core';

export const listing = pgSchema('listing');
