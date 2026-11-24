import type { Db } from '../db/client';
import { processedEvents } from '../db/schema';

export function createProcessedEventRepository(db: Db) {
  return {
    /** true = บันทึกใหม่ · false = เคยประมวลผลแล้ว */
    async markProcessed(eventId: string, type: string): Promise<boolean> {
      const rows = await db.insert(processedEvents).values({ eventId, type }).onConflictDoNothing().returning({ id: processedEvents.eventId });
      return rows.length > 0;
    },
  };
}
export type ProcessedEventRepository = ReturnType<typeof createProcessedEventRepository>;
