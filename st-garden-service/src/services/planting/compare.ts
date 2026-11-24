// เทียบแผนปลูกกับผลนับต้นไม้จากภาพที่ผูกแผนที่แล้ว — คำนวณบน UTM (เมตร)
// จับคู่หลุม↔ต้นแบบหนึ่งต่อหนึ่ง: คู่ที่ห่างไม่เกิน tolerance เรียงจากใกล้สุดก่อน (greedy) — ต้นหนึ่งเข้าได้หลุมเดียว
import { pointInPolygon, type Pt } from '../tree-grid/geometry';
import { utmForward } from '../tree-grid/georef';
import { PointGrid } from '../tree-grid/spatial';

export interface PlanSlot {
  id: string;
  row: number;
  column: number;
  lngLat: Pt;
}
export interface DetectedTree {
  id: string;
  lngLat: Pt;
}

export interface Comparison {
  toleranceM: number;
  matched: { planTreeId: string; surveyTreeId: string; planLngLat: Pt; surveyLngLat: Pt; offsetM: number }[];
  missing: PlanSlot[];
  extra: { surveyTreeId: string; lngLat: Pt; insidePlan: boolean }[];
  stats: {
    planned: number;
    detected: number;
    matched: number;
    missing: number;
    extra: number;
    matchRate: number;
    meanOffsetM: number | null;
    maxOffsetM: number | null;
  };
}

export function comparePlanToSurvey(
  plan: { boundary: readonly Pt[]; slots: readonly PlanSlot[] },
  detected: readonly DetectedTree[],
  toleranceM: number,
): Comparison {
  const meanLng = plan.boundary.reduce((s, p) => s + p[0], 0) / plan.boundary.length;
  const zone = Math.min(60, Math.floor((meanLng + 180) / 6) + 1);
  const toUtm = (p: Pt) => utmForward(p, zone);

  type D = { x: number; y: number; i: number };
  const idx = new PointGrid<D>(Math.max(0.01, toleranceM));
  detected.forEach((d, i) => {
    const [x, y] = toUtm(d.lngLat);
    idx.add({ x, y, i });
  });

  // คู่ที่เป็นไปได้ทั้งหมด → ใกล้สุดก่อน
  const pairs: { s: number; d: number; dist: number }[] = [];
  plan.slots.forEach((slot, si) => {
    const [x, y] = toUtm(slot.lngLat);
    for (const { item, d } of idx.within(x, y, toleranceM)) pairs.push({ s: si, d: item.i, dist: d });
  });
  pairs.sort((a, b) => a.dist - b.dist);
  const slotTaken = new Array<boolean>(plan.slots.length).fill(false);
  const treeTaken = new Array<boolean>(detected.length).fill(false);
  const matched: Comparison['matched'] = [];
  for (const p of pairs) {
    if (slotTaken[p.s] || treeTaken[p.d]) continue;
    slotTaken[p.s] = true;
    treeTaken[p.d] = true;
    const slot = plan.slots[p.s]!;
    const tree = detected[p.d]!;
    matched.push({ planTreeId: slot.id, surveyTreeId: tree.id, planLngLat: slot.lngLat, surveyLngLat: tree.lngLat, offsetM: round2(p.dist) });
  }
  matched.sort((a, b) => a.planTreeId.localeCompare(b.planTreeId));

  const polyUtm = plan.boundary.map(toUtm);
  const missing = plan.slots.filter((_, i) => !slotTaken[i]);
  const extra = detected
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => !treeTaken[i])
    .map(({ d }) => ({ surveyTreeId: d.id, lngLat: d.lngLat, insidePlan: pointInPolygon(toUtm(d.lngLat), polyUtm, true) }));

  const offsets = matched.map((m) => m.offsetM);
  return {
    toleranceM,
    matched,
    missing,
    extra,
    stats: {
      planned: plan.slots.length,
      detected: detected.length,
      matched: matched.length,
      missing: missing.length,
      extra: extra.length,
      matchRate: plan.slots.length ? round4(matched.length / plan.slots.length) : 0,
      meanOffsetM: offsets.length ? round2(offsets.reduce((a, b) => a + b, 0) / offsets.length) : null,
      maxOffsetM: offsets.length ? round2(Math.max(...offsets)) : null,
    },
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
