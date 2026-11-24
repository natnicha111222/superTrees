import { ROUTING_KEYS, type SystemServiceStartedData } from '@supertrees/contracts';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { createEventPublisher } from './events/publisher';
import { createHealthRepository } from './repositories/health.repository';
import { createHealthService } from './services/health.service';

const SERVICE = 'st-parcel-service';
const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const events = await createEventPublisher(config.RABBITMQ_URL, SERVICE);

const app = createApp({ config, health: createHealthService(createHealthRepository(db), SERVICE) });
const server = Bun.serve({ port: config.PORT, hostname: config.HOST, fetch: app.fetch });
console.log(`${SERVICE} ฟังที่ http://${server.hostname}:${server.port} (APP_ENV=${config.APP_ENV})`);
await events.publish<SystemServiceStartedData>(ROUTING_KEYS.systemServiceStarted, { service: SERVICE });

const shutdown = async () => {
  server.stop();
  await events.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
