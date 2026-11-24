// publish event ไป exchange `supertrees.events` (topic) — เรียกหลัง commit เท่านั้น (EVENTS.md)
// ⏳ outbox pattern ยังไม่ทำ: publish ตรงหลัง commit อาจหายถ้า service ล่มระหว่างนั้น (MOCK-005)
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { EVENTS_EXCHANGE, type EventEnvelope } from '@supertrees/contracts';

export interface EventPublisher {
  publish<T>(routingKey: string, data: T, version?: number): Promise<void>;
  close(): Promise<void>;
}

export async function createEventPublisher(url: string | undefined, producer: string): Promise<EventPublisher> {
  if (!url) {
    console.warn(`[events] ไม่ได้ตั้ง RABBITMQ_URL — event จะไม่ถูกส่ง`);
    return { publish: async () => {}, close: async () => {} };
  }
  let conn: ChannelModel | null = null;
  let ch: ConfirmChannel | null = null;

  async function channel(): Promise<ConfirmChannel> {
    if (ch) return ch;
    const c = await amqp.connect(url!);
    c.on('close', () => { conn = null; ch = null; });
    c.on('error', () => {});
    const channel = await c.createConfirmChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    conn = c;
    ch = channel;
    return channel;
  }

  return {
    async publish<T>(routingKey: string, data: T, version = 1) {
      const envelope: EventEnvelope<T> = {
        eventId: Bun.randomUUIDv7(),
        type: routingKey,
        version,
        occurredAt: new Date().toISOString(),
        producer,
        data,
      };
      try {
        const c = await channel();
        c.publish(EVENTS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), {
          persistent: true,
          contentType: 'application/json',
          messageId: envelope.eventId,
        });
        await c.waitForConfirms();
      } catch (e) {
        // งานหลัก commit ไปแล้ว — ไม่ทำให้ request ล้ม แต่ต้องเห็นใน log
        console.error(`[events] publish ${routingKey} ไม่สำเร็จ:`, (e as Error).message);
      }
    },
    async close() {
      await conn?.close().catch(() => {});
    },
  };
}
