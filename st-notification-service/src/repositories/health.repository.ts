import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';

export function createHealthRepository(db: Db) {
  return {
    async postgisVersion(): Promise<string> {
      const rows = await db.execute<{ v: string }>(sql`select postgis_version() as v`);
      return rows[0]?.v ?? '';
    },
  };
}
export type HealthRepository = ReturnType<typeof createHealthRepository>;
