import { describe, expect, test } from 'bun:test';
import { MAX_PLANNED_TREES, planPlantingLayout, PlantingError } from '../src/services/planting/layout';
import { utmForward, utmInverse } from '../src/services/tree-grid/georef';
import type { Pt } from '../src/services/tree-grid/geometry';

const ZONE = 47;
const E0 = 680000, N0 = 1560000; // ราว 14.1°N 100.7°E
/** สี่เหลี่ยม w×h ม. หมุน deg รอบมุมแรก → [lng, lat] (ขอบแรก = ด้านยาว w) */
function rect(w: number, h: number, deg = 0): Pt[] {
  const a = (deg * Math.PI) / 180;
  return ([[0, 0], [w, 0], [w, h], [0, h]] as const).map(([x, y]) =>
    utmInverse([E0 + x * Math.cos(a) - y * Math.sin(a), N0 + x * Math.sin(a) + y * Math.cos(a)], ZONE),
  );
}
const dist = (a: Pt, b: Pt) => {
  const [x0, y0] = utmForward(a, ZONE);
  const [x1, y1] = utmForward(b, ZONE);
  return Math.hypot(x1 - x0, y1 - y0);
};

describe('วางแผนปลูก', () => {
  test('แปลง 100×60 ม. ระยะ 10 ม. → 10×6 = 60 ต้น ห่างกัน 10 ม. พื้นที่ 6,000 ตร.ม.', () => {
    const r = planPlantingLayout({ boundary: rect(100, 60), spacingM: 10 });
    expect(r.trees).toHaveLength(60);
    expect(r.rowCount).toBe(6);
    expect(r.utmEpsg).toBe(32647);
    expect(r.areaSqm).toBeCloseTo(6000, -1);
    expect(dist(r.trees[0]!.lngLat, r.trees[1]!.lngLat)).toBeCloseTo(10, 2);
    expect(dist(r.trees[0]!.lngLat, r.trees[10]!.lngLat)).toBeCloseTo(10, 2);
    expect(r.trees[0]).toMatchObject({ treeId: 'TREE_001', row: 1, column: 1 });
  });

  test('แปลงเอียง 30° → ตารางเอียงตามขอบแรก จำนวนเท่าเดิม', () => {
    const r = planPlantingLayout({ boundary: rect(100, 60, 30), spacingM: 10 });
    expect(r.trees).toHaveLength(60);
    expect(r.angleDeg).toBeCloseTo(30, 3);
    const [a, b] = [utmForward(r.trees[0]!.lngLat, ZONE), utmForward(r.trees[1]!.lngLat, ZONE)];
    // พิกัดปัด 7 ตำแหน่ง (~1 ซม.) → มุมระหว่างต้นที่ห่าง 10 ม. คลาดได้ ~0.01°
    expect((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI).toBeCloseTo(30, 1);
  });

  test('แปลงสามเหลี่ยม → นับเฉพาะจุดข้างใน · ระบุมุมเองได้', () => {
    const [p0, p1, , p3] = rect(100, 100);
    const r = planPlantingLayout({ boundary: [p0!, p1!, p3!], spacingM: 10 });
    expect(r.trees.length).toBeGreaterThan(40);
    expect(r.trees.length).toBeLessThan(60);
    const rotated = planPlantingLayout({ boundary: rect(100, 60), spacingM: 10, angleDeg: 90 });
    expect(rotated.angleDeg).toBe(90);
  });

  test('error: จุดไม่พอ / ใต้เส้นศูนย์สูตร / ต้นไม้มากเกิน', () => {
    expect(() => planPlantingLayout({ boundary: rect(10, 10).slice(0, 2), spacingM: 2 })).toThrow(PlantingError);
    expect(() => planPlantingLayout({ boundary: [[100, -1], [100.1, -1], [100.1, -1.1]], spacingM: 2 })).toThrow(PlantingError);
    try {
      planPlantingLayout({ boundary: rect(2000, 2000), spacingM: 1 });
      throw new Error('ควร throw');
    } catch (e) {
      expect((e as PlantingError).code).toBe('TOO_MANY_TREES');
    }
    expect(MAX_PLANNED_TREES).toBe(20000);
  });
});

describe('แก้แผนปลูก (editor)', () => {
  const base = { boundary: rect(100, 60), spacingM: 10 };

  test('เลื่อนกริด 3 ม. ตามแนวแถว → หมุดทุกต้นขยับ 3 ม. จำนวนเท่าเดิม', () => {
    const a = planPlantingLayout(base);
    const b = planPlantingLayout({ ...base, offsetM: [3, 0] });
    expect(b.trees).toHaveLength(60);
    expect(b.offsetM).toEqual([3, 0]);
    expect(dist(a.trees[0]!.lngLat, b.trees[0]!.lngLat)).toBeCloseTo(3, 2);
  });

  test('เลื่อนเกินครึ่งช่อง → แถว/คอลัมน์ใหม่เข้ามาในแปลง ช่องที่หลุดขอบหายไป', () => {
    const b = planPlantingLayout({ ...base, offsetM: [-6, 0] });
    // จุดอ้างอิงเลื่อนพ้นขอบซ้าย → คอลัมน์ก่อนหน้าเข้ามา (x = -1+10k → 9 คอลัมน์ข้างใน)
    expect(b.trees.length).toBe(60);
    expect(b.trees.every((t) => t.column >= 1 && t.row >= 1)).toBe(true);
  });

  test('ลบหมุด (ตามตำแหน่ง) → หายไป · เลื่อนกริดเล็กน้อยยังหายอยู่ · ไม่ส่ง removed = กลับมาครบ', () => {
    const a = planPlantingLayout(base);
    const removed = [a.trees[0]!.lngLat, a.trees[15]!.lngLat];
    const b = planPlantingLayout({ ...base, removed });
    expect(b.trees).toHaveLength(58);
    const c = planPlantingLayout({ ...base, removed, offsetM: [1, -1] });
    expect(c.trees).toHaveLength(58);
    expect(planPlantingLayout(base).trees).toHaveLength(60);
  });

  test('เพิ่มหมุดเอง → อยู่ตำแหน่งเดิม ติดป้าย manual และได้แถว/คอลัมน์ของจุดตัดที่ใกล้สุด', () => {
    const a = planPlantingLayout(base);
    const [lng, lat] = a.trees[0]!.lngLat;
    const extra: Pt = [lng + 0.00002, lat - 0.00002];
    const b = planPlantingLayout({ ...base, extras: [extra] });
    expect(b.trees).toHaveLength(61);
    const m = b.trees.find((t) => t.manual)!;
    expect(m.lngLat).toEqual([Number(extra[0].toFixed(7)), Number(extra[1].toFixed(7))]);
    expect([m.row, m.column]).toEqual([1, 1]);
  });

  test('เส้นกริดครอบแปลง: 10 คอลัมน์ + 6 แถว (+ ขอบครึ่งช่อง)', () => {
    const a = planPlantingLayout(base);
    expect(a.gridLines.length).toBeGreaterThanOrEqual(16);
    expect(a.gridLines.length).toBeLessThanOrEqual(20);
  });
});
