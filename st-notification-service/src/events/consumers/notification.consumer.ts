// queue ของ service เอง + dead-letter queue (EVENTS.md) · ล้มเหลว → DLQ ไม่วนไม่จบ
import amqp from 'amqplib';
import { EVENTS_EXCHANGE, type EventEnvelope } from '@supertrees/contracts';
import type { EventHandlerService } from '../../services/event-handler.service';

const QUEUE = 'notification.events';
const DLX = 'supertrees.events.dlx';

export async function startNotificationConsumer(url: string | undefined, keys: readonly string[], handler: EventHandlerService) {
  if (!url) {
    console.warn('[events] ไม่ได้ตั้ง RABBITMQ_URL — ไม่รับ event');
    return { close: async () => {} };
  }
  const conn = await amqp.connect(url);
  conn.on('error', () => {});
  const ch = await conn.createChannel();
  await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
  await ch.assertExchange(DLX, 'direct', { durable: true });
  await ch.assertQueue(`${QUEUE}.dlq`, { durable: true });
  await ch.bindQueue(`${QUEUE}.dlq`, DLX, QUEUE);
  await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: DLX, deadLetterRoutingKey: QUEUE });
  for (const key of keys) await ch.bindQueue(QUEUE, EVENTS_EXCHANGE, key);
  await ch.prefetch(10);

  await ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      await handler.handle(JSON.parse(msg.content.toString()) as EventEnvelope);
      ch.ack(msg);
    } catch (e) {
      console.error('[events] ประมวลผลไม่สำเร็จ → DLQ:', (e as Error).message);
      ch.nack(msg, false, false);
    }
  });
  console.log(`[events] รับ ${keys.join(', ')} ที่ queue ${QUEUE}`);
  return { close: async () => { await conn.close().catch(() => {}); } };
}
