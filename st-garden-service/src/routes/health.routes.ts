import { Hono } from 'hono';
import type { HealthService } from '../services/health.service';

/** GET /api/v1/gardens/health — ไม่ต้อง login */
export function healthRoutes(health: HealthService) {
  return new Hono().get('/', async (c) => {
    const body = await health.check();
    return c.json(body, body.status === 'ok' ? 200 : 503);
  });
}
