import { describe, expect, test } from 'bun:test';
import { createEventHandlerService } from '../src/services/event-handler.service';

describe('event handler — idempotent', () => {
  test('eventId ซ้ำ → duplicate ไม่ประมวลผลซ้ำ', async () => {
    const seen = new Set<string>();
    const logs: string[] = [];
    const svc = createEventHandlerService({ markProcessed: async (id) => (seen.has(id) ? false : (seen.add(id), true)) }, (m) => logs.push(m));
    const env = { eventId: '0190a0a0-0000-7000-8000-000000000001', type: 'system.service.started', version: 1, occurredAt: '2026-11-23T08:00:00Z', producer: 'x', data: { service: 'x' } };
    expect(await svc.handle(env)).toBe('processed');
    expect(await svc.handle(env)).toBe('duplicate');
    expect(logs).toHaveLength(1);
  });
});
