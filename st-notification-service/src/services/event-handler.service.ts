// ประมวลผล event ที่รับมา — กันซ้ำด้วย eventId
// ⏳ การแจ้งเตือนจริง (in-app / push) มาใน TASK ภายหลัง — ตอนนี้แค่ log (TASK-002 ทดสอบเส้นทาง event)
import { ROUTING_KEYS, type EventEnvelope } from '@supertrees/contracts';
import type { ProcessedEventRepository } from '../repositories/processed-event.repository';

export const SUBSCRIBED_KEYS = [ROUTING_KEYS.systemServiceStarted, ROUTING_KEYS.gardenTreeSurveyCompleted];

export function createEventHandlerService(repo: ProcessedEventRepository, log: (msg: string) => void = console.log) {
  return {
    async handle(envelope: EventEnvelope): Promise<'processed' | 'duplicate'> {
      if (!(await repo.markProcessed(envelope.eventId, envelope.type))) return 'duplicate';
      log(`[event] ${envelope.type} จาก ${envelope.producer}: ${JSON.stringify(envelope.data)}`);
      return 'processed';
    },
  };
}
export type EventHandlerService = ReturnType<typeof createEventHandlerService>;
