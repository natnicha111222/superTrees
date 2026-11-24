import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import type { Config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { healthRoutes } from './routes/health.routes';
import type { HealthService } from './services/health.service';

export interface AppDeps {
  config: Config;
  health: HealthService;
}

export function createApp({ health }: AppDeps) {
  const app = new Hono();
  app.use('*', requestId());
  app.use('*', bodyLimit({ maxSize: 512 * 1024 }));
  app.route('/api/v1/notifications/health', healthRoutes(health));
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  return app;
}
