import type { HealthResponse } from '@supertrees/contracts';
import type { HealthRepository } from '../repositories/health.repository';

export function createHealthService(repo: HealthRepository, service: string) {
  return {
    async check(): Promise<HealthResponse> {
      const checks: HealthResponse['checks'] = {};
      try {
        checks.postgis = { ok: true, detail: await repo.postgisVersion() };
      } catch {
        checks.postgis = { ok: false, detail: 'เชื่อมต่อฐานข้อมูลไม่ได้' };
      }
      return {
        service,
        status: Object.values(checks).every((c) => c.ok) ? 'ok' : 'degraded',
        time: new Date().toISOString(),
        checks,
      };
    },
  };
}
export type HealthService = ReturnType<typeof createHealthService>;
