/** error รูปแบบเดียวทุก service (CLAUDE.md) */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** รายการแบ่งหน้า (CLAUDE.md) — page เริ่มที่ 1 */
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
}

export interface HealthResponse {
  service: string;
  status: 'ok' | 'degraded';
  /** ISO-8601 UTC */
  time: string;
  checks: Record<string, { ok: boolean; detail?: string }>;
}

/** [lng, lat] SRID 4326 — ลำดับนี้เสมอ (CLAUDE.md) */
export type LngLat = [number, number];
