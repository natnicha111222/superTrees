import { describe, expect, test } from 'bun:test';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createHealthService } from '../src/services/health.service';

const config = loadConfig({ DATABASE_URL: 'postgres://x' });

describe('GET /api/v1/notifications/health', () => {
  test('DB ใช้ได้ → 200 ok', async () => {
    const app = createApp({ config, health: createHealthService({ postgisVersion: async () => '3.5 USE_GEOS=1' }, 'st-notification-service') });
    const res = await app.request('/api/v1/notifications/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ service: 'st-notification-service', status: 'ok', checks: { postgis: { ok: true } } });
  });

  test('DB ล่ม → 503 degraded (ไม่ส่งรายละเอียด error ออกไป)', async () => {
    const app = createApp({ config, health: createHealthService({ postgisVersion: async () => { throw new Error('password authentication failed'); } }, 'st-notification-service') });
    const res = await app.request('/api/v1/notifications/health');
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain('password');
  });

  test('เส้นที่ไม่มี → 404 รูปแบบ error กลาง', async () => {
    const app = createApp({ config, health: createHealthService({ postgisVersion: async () => '' }, 'st-notification-service') });
    const res = await app.request('/api/v1/notifications/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});
