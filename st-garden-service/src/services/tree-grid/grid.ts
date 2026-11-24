// จัดต้นไม้ลงตาราง (แถว/ลำดับ) + เส้นกริด — แทนขั้นตอนที่ 3–4 ของสคริปต์ต้นฉบับ
//
// กริดอธิบายด้วย GridParams: มุม + ระยะช่อง + จุดตัดอ้างอิง (origin) บนภาพ
// ใช้แกนกริดร่วม (../grid/core.ts) เหมือนวางแผนปลูก — กติกาแถว/คอลัมน์/จุดตัด/เติมจุดเดียวกัน
// - autoGridParams(): หาค่าอัตโนมัติ (มุมจากกรอบพื้นที่น้อยสุด, ระยะ = มัธยฐานระยะต้นที่ใกล้สุด, origin = ต้นมุมซ้ายบน)
// - ผู้ใช้ปรับเองได้ (เลื่อน/หมุน/ระยะ — editor ใน TASK-010) แล้วส่งค่ากลับมาคำนวณใหม่ด้วยฟังก์ชันเดียวกัน
// ต้นฉบับใช้ perspective transform จากกรอบ minAreaRect ไปเป็นสี่เหลี่ยมตั้งตรงขนาดเท่ากัน ซึ่งเท่ากับการหมุน จึงเขียนเป็นการหมุนตรง ๆ

import { assignToGrid, awayFrom, frame, gridLines as coreGridLines, intersectionsInside, type Grid } from '../grid/core';
import { dist, minAreaRect, type Pt } from './geometry';
import type { Georef } from './georef';
import { PointGrid } from './spatial';

export interface GridParams {
  /** มุมของแนวแถวเทียบแนวนอนของภาพ (องศา) */
  angleDeg: number;
  /** ระยะช่องตาราง (พิกเซล) */
  spacingPx: number;
  /** จุดตัดของกริดจุดหนึ่ง (พิกัดพิกเซลของภาพ) */
  originX: number;
  originY: number;
}

export interface GridTree {
  treeId: string;
  orderNum: number;
  /** เริ่มที่ 1 */
  row: number;
  /** เริ่มที่ 1 (คอลัมน์ซ้ายสุดที่มีต้นไม้) */
  column: number;
  pixelX: number;
  pixelY: number;
  nearestTreeId: string;
  nearestDistancePx: number;
  nearestDistanceM: number | null;
  /** [lng, lat] SRID 4326 — มีเฉพาะเมื่อผูกภาพกับแผนที่ (scale.kind = 'georef') */
  lngLat: [number, number] | null;
}

export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** v = แนวคอลัมน์, h = แนวแถว */
  orientation: 'v' | 'h';
}

export type ScaleInput =
  /** CONF-005 ทางเลือก B: ผูกภาพกับแผนที่จากจุดคู่ (fitGeoref) — ได้ทั้งระยะจริงและตำแหน่ง */
  | { kind: 'georef'; georef: Georef }
  | { kind: 'metersPerPixel'; metersPerPixel: number }
  // MOCK-001: ทางลัดของต้นฉบับ — สมมติว่าระยะช่องตาราง (= ระยะปลูก) = ค่านี้ แล้วคิดมาตราส่วนย้อนกลับ (ระยะที่ได้จึงไม่ใช่ค่าวัดจริง)
  | { kind: 'assumedSpacing'; spacingM: number }
  | { kind: 'none' };

export interface TreeGrid {
  trees: GridTree[];
  gridLines: GridLine[];
  stats: {
    treeCount: number;
    rowCount: number;
    /** มัธยฐานระยะถึงต้นที่ใกล้สุด (พิกเซล) */
    medianSpacingPx: number;
    meanNearestDistancePx: number;
    metersPerPixel: number | null;
    scaleSource: ScaleInput['kind'];
    /** true = ระยะเป็นค่าประมาณจากระยะปลูกที่ผู้ใช้ระบุ ไม่ใช่ค่าวัด → หน้าจอต้องติดป้าย "ประมาณ" (MOCK-001) */
    scaleIsEstimate: boolean;
    meanNearestDistanceM: number | null;
    georef: { epsg: number; rmsErrorM: number } | null;
    /** = grid.angleDeg */
    gridAngleDeg: number;
    /** ค่ากริดที่ใช้จริง (ส่งกลับไปแก้ต่อได้) */
    grid: GridParams;
  };
}

export class GridError extends Error {
  constructor(readonly code: 'TOO_FEW_TREES' | 'GRID_INVALID', message: string) {
    super(message);
  }
}

/** ต้องมีอย่างน้อยเท่านี้ถึงจะหาระยะต้นที่ใกล้สุด/จัดแถวได้ */
export const MIN_TREES_FOR_GRID = 2;

// ── กริดอัตโนมัติ ────────────────────────────────────────────────────────────

export function autoGridParams(points: readonly Pt[]): GridParams {
  if (points.length < MIN_TREES_FOR_GRID) {
    throw new GridError('TOO_FEW_TREES', `ต้องมีต้นไม้อย่างน้อย ${MIN_TREES_FOR_GRID} ต้นเพื่อคำนวณตาราง`);
  }
  const { nearestPx } = nearestNeighbors(points);
  const angleDeg = (minAreaRect(points).angle * 180) / Math.PI;
  const f = frame(angleDeg);
  // origin = ต้นที่อยู่มุมซ้ายบนสุดในกรอบที่หมุนแล้ว
  let first = points[0]!;
  let best = Infinity;
  for (const p of points) {
    const [u, v] = f.toUV(p);
    if (u + v < best) {
      best = u + v;
      first = p;
    }
  }
  return { angleDeg, spacingPx: median(nearestPx), originX: first[0], originY: first[1] };
}

/** เติมค่าที่ไม่ได้ส่งมาด้วยค่าอัตโนมัติ · null/undefined = อัตโนมัติทั้งหมด */
export function resolveGridParams(points: readonly Pt[], partial?: Partial<GridParams> | null): GridParams {
  const given = stripUndefined(partial ?? {});
  const complete = given.angleDeg !== undefined && given.spacingPx !== undefined && given.originX !== undefined && given.originY !== undefined;
  const p: GridParams = complete ? (given as GridParams) : { ...autoGridParams(points), ...given };
  if (!(p.spacingPx > 0) || !Number.isFinite(p.spacingPx) || !Number.isFinite(p.angleDeg) || !Number.isFinite(p.originX) || !Number.isFinite(p.originY)) {
    throw new GridError('GRID_INVALID', 'ค่าตารางไม่ถูกต้อง');
  }
  return p;
}

// ── จัดตาราง ─────────────────────────────────────────────────────────────────

export interface BuildOptions {
  /** ค่ากริด (ไม่ส่ง/ส่งบางส่วน = อัตโนมัติ) */
  grid?: Partial<GridParams> | null;
  /** เส้นกริดครอบพื้นที่นี้ (เช่นขอบเขตแปลง) — ไม่ส่ง = ครอบต้นไม้ */
  extent?: readonly Pt[];
}

export function buildTreeGrid(points: readonly Pt[], scale: ScaleInput, opts: BuildOptions = {}): TreeGrid {
  const n = points.length;
  if (n < MIN_TREES_FOR_GRID) {
    throw new GridError('TOO_FEW_TREES', `ต้องมีต้นไม้อย่างน้อย ${MIN_TREES_FOR_GRID} ต้นเพื่อจัดตาราง`);
  }
  const grid = resolveGridParams(points, opts.grid);
  const { nearestIdx, nearestPx } = nearestNeighbors(points);

  const georef = scale.kind === 'georef' ? scale.georef : null;
  const metersPerPixel =
    scale.kind === 'georef' ? scale.georef.metersPerPixel
    : scale.kind === 'metersPerPixel' ? scale.metersPerPixel
    : scale.kind === 'assumedSpacing' ? scale.spacingM / grid.spacingPx
    : null;
  // ระยะจริง: ถ้าผูกแผนที่แล้ววัดบน UTM ตรง ๆ (รองรับพิกเซลไม่จัตุรัส) · ไม่งั้นคูณ m/px
  const utm = georef ? points.map((p) => georef.pixelToUtm(p)) : null;
  const nearestM = nearestPx.map((d, i) =>
    utm ? dist(utm[i]!, utm[nearestIdx[i]!]!) : metersPerPixel === null ? null : d * metersPerPixel,
  );

  // แถว/คอลัมน์ = จุดตัดกริดที่ใกล้ที่สุด (กติการ่วม — นับจากเส้นกริดแรกในขอบเขตแปลง)
  const cg = toCore(grid);
  const extent = opts.extent?.length ? opts.extent : points;
  const { order, row, col, rowCount } = assignToGrid(points, cg, extent);

  const idOf = new Array<string>(n);
  order.forEach((orig, k) => { idOf[orig] = treeId(k + 1); });

  const trees: GridTree[] = order.map((orig, k) => ({
    treeId: idOf[orig]!,
    orderNum: k + 1,
    row: row[orig]!,
    column: col[orig]!,
    pixelX: Math.round(points[orig]![0]),
    pixelY: Math.round(points[orig]![1]),
    nearestTreeId: idOf[nearestIdx[orig]!]!,
    nearestDistancePx: round2(nearestPx[orig]!),
    nearestDistanceM: nearestM[orig] == null ? null : round2(nearestM[orig]!),
    lngLat: georef ? roundLngLat(georef.pixelToLngLat(points[orig]!)) : null,
  }));

  const meanPx = nearestPx.reduce((a, b) => a + b, 0) / n;
  return {
    trees,
    gridLines: coreGridLines(cg, extent).map(([a, b, o]) => line(a, b, o)),
    stats: {
      treeCount: n,
      rowCount,
      medianSpacingPx: round2(median(nearestPx)),
      meanNearestDistancePx: round2(meanPx),
      metersPerPixel: metersPerPixel === null ? null : Number(metersPerPixel.toFixed(6)),
      scaleSource: scale.kind,
      scaleIsEstimate: scale.kind === 'assumedSpacing',
      meanNearestDistanceM: metersPerPixel === null ? null : round2(nearestM.reduce((a: number, b) => a + b!, 0) / n),
      georef: georef ? { epsg: georef.epsg, rmsErrorM: round2(georef.rmsErrorM) } : null,
      gridAngleDeg: round2(grid.angleDeg),
      grid: { angleDeg: round4(grid.angleDeg), spacingPx: round4(grid.spacingPx), originX: round2(grid.originX), originY: round2(grid.originY) },
    },
  };
}

/**
 * จุดตัดกริดที่อยู่ในขอบเขตและยังไม่มีต้นไม้ใกล้กว่า minGapFraction × ระยะช่อง (ต้นฉบับ: 0.45)
 * — ใช้เติมต้นที่ตรวจไม่พบ (ปุ่ม "เติมจุดตามตาราง")
 */
export function gridGapPoints(points: readonly Pt[], grid: GridParams, boundary: readonly Pt[]): Pt[] {
  // จุดบนเส้นขอบไม่นับ (คนปักขอบเขตรอบต้นไม้ — ต้นฉบับ ray casting ก็ไม่นับขอบขวา/ล่าง)
  const inside = intersectionsInside(toCore(grid), boundary, 50_000) ?? [];
  return awayFrom(inside, points, grid.spacingPx).map(([x, y]) => [Math.round(x), Math.round(y)] as const);
}

// ── ภายใน ───────────────────────────────────────────────────────────────────

function toCore(g: GridParams): Grid {
  return { angleDeg: g.angleDeg, spacing: g.spacingPx, originX: g.originX, originY: g.originY };
}

function nearestNeighbors(points: readonly Pt[]) {
  const n = points.length;
  type Item = { x: number; y: number; i: number };
  const items: Item[] = points.map(([x, y], i) => ({ x, y, i }));
  const index = new PointGrid<Item>(cellSizeFor(points));
  items.forEach((it) => index.add(it));
  const nearestIdx = new Array<number>(n);
  const nearestPx = new Array<number>(n);
  for (const it of items) {
    const nb = index.nearest(it.x, it.y, it)!;
    nearestIdx[it.i] = nb.item.i;
    nearestPx[it.i] = nb.d;
  }
  return { nearestIdx, nearestPx };
}

/** ขนาดช่องให้เฉลี่ย ~1 จุดต่อช่อง */
function cellSizeFor(points: readonly Pt[]): number {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const area = Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
  return Math.max(1, Math.sqrt(area / points.length));
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

function line(a: Pt, b: Pt, orientation: 'v' | 'h'): GridLine {
  return { x1: round2(a[0]), y1: round2(a[1]), x2: round2(b[0]), y2: round2(b[1]), orientation };
}

function treeId(n: number): string {
  return `T_${String(n).padStart(3, '0')}`;
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/** 7 ตำแหน่งทศนิยม ≈ 1 ซม. */
function roundLngLat([lng, lat]: Pt): [number, number] {
  return [Number(lng.toFixed(7)), Number(lat.toFixed(7))];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
