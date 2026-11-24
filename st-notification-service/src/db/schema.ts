// schema `notify` — เจ้าของคือ st-notification-service เท่านั้น (ห้าม service อื่น query)
import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const notify = pgSchema('notify');

/** eventId ที่ประมวลผลแล้ว — consumer ต้อง idempotent (EVENTS.md) */
export const processedEvents = notify
  .table('processed_events', {
    eventId: uuid('event_id').primaryKey(),
    type: text('type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  })
  .enableRLS();
