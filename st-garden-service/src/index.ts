import { ROUTING_KEYS, type SystemServiceStartedData } from '@supertrees/contracts';
import { createApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { createEventPublisher } from './events/publisher';
import { createHealthRepository } from './repositories/health.repository';
import { createPhotoStorage } from './repositories/photo-storage.repository';
import { createPlantingPlanRepository } from './repositories/planting-plan.repository';
import { createTreeSurveyRepository } from './repositories/tree-survey.repository';
import { createHealthService } from './services/health.service';
import { createPlantingPlanService } from './services/planting-plan.service';
import { createTreeSurveyService } from './services/tree-survey.service';

const SERVICE = 'st-garden-service';
const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);
const events = await createEventPublisher(config.RABBITMQ_URL, SERVICE);

const treeSurveyRepo = createTreeSurveyRepository(db);

const app = createApp({
  config,
  health: createHealthService(createHealthRepository(db), SERVICE),
  treeSurveys: createTreeSurveyService({
    repo: treeSurveyRepo,
    storage: createPhotoStorage({
      supabaseUrl: config.SUPABASE_URL,
      publicUrl: config.SUPABASE_PUBLIC_URL,
      serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    }),
    events,
  }),
  plantingPlans: createPlantingPlanService({ repo: createPlantingPlanRepository(db), surveys: treeSurveyRepo, events }),
});

const server = Bun.serve({ port: config.PORT, hostname: config.HOST, fetch: app.fetch });
console.log(`${SERVICE} ฟังที่ http://${server.hostname}:${server.port} (APP_ENV=${config.APP_ENV}, AUTH_MODE=${config.AUTH_MODE})`);
if (config.AUTH_MODE === 'dev-fixed-user') {
  console.warn(`⚠️  MOCK-002: ทุก request เป็นผู้ใช้ ${config.DEV_USER_ID} — ห้ามใช้นอกเครื่อง dev`);
}
await events.publish<SystemServiceStartedData>(ROUTING_KEYS.systemServiceStarted, { service: SERVICE });

const shutdown = async () => {
  server.stop();
  await events.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
