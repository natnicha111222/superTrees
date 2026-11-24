import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import type { Config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { healthRoutes } from './routes/health.routes';
import { plantingPlanRoutes } from './routes/planting-plan.routes';
import { treeSurveyRoutes } from './routes/tree-survey.routes';
import type { HealthService } from './services/health.service';
import type { PlantingPlanService } from './services/planting-plan.service';
import type { TreeSurveyService } from './services/tree-survey.service';

export interface AppDeps {
  config: Config;
  health: HealthService;
  treeSurveys: TreeSurveyService;
  plantingPlans: PlantingPlanService;
}

export function createApp({ config, health, treeSurveys, plantingPlans }: AppDeps) {
  const app = new Hono();
  app.use('*', requestId());
  // ภาพไม่ผ่าน service (อัปโหลดตรงไป Storage) — body เป็น JSON เล็ก ๆ เท่านั้น
  app.use('*', bodyLimit({ maxSize: 512 * 1024 }));
  app.route('/api/v1/gardens/health', healthRoutes(health));
  app.route('/api/v1/gardens/:parcelId/tree-surveys', treeSurveyRoutes(config, treeSurveys));
  app.route('/api/v1/gardens/:parcelId/planting-plans', plantingPlanRoutes(config, plantingPlans));
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}
