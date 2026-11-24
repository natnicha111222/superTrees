import { describe, expect, test } from 'bun:test';
import { comparePlanToSurvey } from '../src/services/planting/compare';
import { planPlantingLayout } from '../src/services/planting/layout';
import { utmForward, utmInverse } from '../src/services/tree-grid/georef';
import type { Pt } from '../src/services/tree-grid/geometry';

const Z = 47;
const field: Pt[] = ([[0, 0], [80, 0], [80, 40], [0, 40]] as const).map(([x, y]) => utmInverse([680000 + x, 1560000 + y], Z));
const plan = planPlantingLayout({ boundary: field, spacingM: 8 }); // 10 × 5 = 50 หลุม
const slots = plan.trees.map((t) => ({ id: t.treeId, row: t.row, column: t.column, lngLat: t.lngLat as Pt }));
/** ขยับพิกัดไปทางตะวันออก/เหนือ (เมตร) */
const move = (p: Pt, de: number, dn: number): Pt => {
  const [e, n] = utmForward(p, Z);
  return utmInverse([e + de, n + dn], Z);
};

describe('เทียบแผนปลูกกับผลนับ', () => {
  test('ทุกหลุมมีต้น (คลาด 0.6 ม.) ยกเว้น 3 หลุม + ต้นนอกแผน 2 ต้น (ในแปลง 1, นอก 1)', () => {
    const detected = slots
      .filter((_, i) => ![4, 17, 33].includes(i))
      .map((s, i) => ({ id: `T_${i + 1}`, lngLat: move(s.lngLat, 0.6, 0) }));
    detected.push({ id: 'X_IN', lngLat: move(slots[0]!.lngLat, 4, 4) }); // กลางช่อง — ห่างทุกหลุม > 4 ม.
    detected.push({ id: 'X_OUT', lngLat: move(field[0]!, -10, -10) });
    const r = comparePlanToSurvey({ boundary: field, slots }, detected, 4);
    expect(r.stats).toMatchObject({ planned: 50, detected: 49, matched: 47, missing: 3, extra: 2 });
    expect(r.stats.matchRate).toBeCloseTo(0.94, 4);
    expect(r.stats.meanOffsetM).toBeCloseTo(0.6, 1);
    expect(r.missing.map((m) => m.id)).toEqual([slots[4]!.id, slots[17]!.id, slots[33]!.id]);
    expect(r.extra.find((e) => e.surveyTreeId === 'X_IN')!.insidePlan).toBe(true);
    expect(r.extra.find((e) => e.surveyTreeId === 'X_OUT')!.insidePlan).toBe(false);
  });

  test('ต้นเดียวไม่จับคู่สองหลุม · หลุมเดียวไม่จับคู่สองต้น (ใกล้สุดได้ก่อน)', () => {
    const near = move(slots[0]!.lngLat, 0.3, 0);
    const far = move(slots[0]!.lngLat, 1.5, 0);
    const r = comparePlanToSurvey({ boundary: field, slots: slots.slice(0, 1) }, [{ id: 'A', lngLat: far }, { id: 'B', lngLat: near }], 4);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.surveyTreeId).toBe('B');
    expect(r.extra.map((e) => e.surveyTreeId)).toEqual(['A']);
  });
});
