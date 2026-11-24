import { ROUTING_KEYS, type SystemServiceStartedData } from '@supertrees/contracts';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { startNotificationConsumer } from './events/consumers/notification.consumer';
import { createEventPublisher } from './events/publisher';
import { createHealthRepository } from './repositories/health.repository';
import { createProcessedEventRepository } from './repositories/processed-event.repository';
import { createEventHandlerService, SUBSCRIBED_KEYS } from './services/event-handler.service';
import { createHealthService } from './services/health.service';

const SERVICE = 'st-notification-service';
const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const events = await createEventPublisher(config.RABBITMQ_URL, SERVICE);
const consumer = await startNotificationConsumer(
  config.RABBITMQ_URL,
  SUBSCRIBED_KEYS,
  createEventHandlerService(createProcessedEventRepository(db)),
).catch((e) => {
  console.error('[events] เชื่อม RabbitMQ ไม่ได้ — ไม่รับ event:', (e as Error).message);
  return { close: async () => {} };
});

const app = createApp({ config, health: createHealthService(createHealthRepository(db), SERVICE) });
const server = Bun.serve({ port: config.PORT, hostname: config.HOST, fetch: app.fetch });
console.log(`${SERVICE} ฟังที่ http://${server.hostname}:${server.port} (APP_ENV=${config.APP_ENV})`);
await events.publish<SystemServiceStartedData>(ROUTING_KEYS.systemServiceStarted, { service: SERVICE });

const shutdown = async () => {
  server.stop();
  await consumer.close();
  await events.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
