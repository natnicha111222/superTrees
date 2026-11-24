// แกนกริดร่วม: กติกาเดียวกันทั้งหน่วยพิกเซล (นับจากภาพ) และเมตร (วางแผนปลูก)
import { describe, expect, test } from 'bun:test';
import { assignToGrid, awayFrom, gridLines, intersectionsInside, shiftGrid, type Grid } from '../src/services/grid/core';
import type { Pt } from '../src/services/tree-grid/geometry';

const square = (w: number): Pt[] => [[0, 0], [w, 0], [w, w], [0, w]];

describe('grid core', () => {
  const g: Grid = { angleDeg: 0, spacing: 10, originX: 5, originY: 5 };

  test('จุดตัดในแปลง: ไม่รวมบนเส้นขอบ', () => {
    expect(intersectionsInside(g, square(100), 1000)).toHaveLength(100);
    // ขอบขวา/ล่างที่ 95 → จุดตัดที่ 95 อยู่บนเส้นขอบ ไม่นับ
    expect(intersectionsInside(g, square(95), 1000)).toHaveLength(81);
    expect(intersectionsInside(g, square(100), 50)).toBeNull();
  });

  test('เลขแถว/คอลัมน์เริ่มจากช่องแรกในแปลง — ช่องว่างหน้าต้นแรกนับรวม', () => {
    const pts: Pt[] = [[25, 15], [35, 15], [25, 25]];
    const a = assignToGrid(pts, g, square(100));
    expect(a.row).toEqual([2, 2, 3]);
    expect(a.col).toEqual([3, 4, 3]);
    expect(a.order).toEqual([0, 1, 2]);
    // ไม่ส่งขอบเขต → นับจากจุดเอง
    expect(assignToGrid(pts, g).col).toEqual([1, 2, 1]);
  });

  test('ไม่ขึ้นกับหน่วย: พิกเซล ×10 ให้แถว/คอลัมน์เท่าเมตร', () => {
    const m: Pt[] = [[25, 15], [35, 15], [25, 25], [44, 33]];
    const px = m.map(([x, y]) => [x * 10, y * 10] as const);
    const gpx: Grid = { angleDeg: 0, spacing: 100, originX: 50, originY: 50 };
    const a = assignToGrid(m, g, square(100));
    const b = assignToGrid(px, gpx, square(1000));
    expect(b.row).toEqual(a.row);
    expect(b.col).toEqual(a.col);
  });

  test('awayFrom (0.45 ช่อง) · shiftGrid ตามแนวกริด · gridLines ครอบขอบเขต', () => {
    expect(awayFrom([[5, 5], [15, 5]], [[8, 5]], 10)).toEqual([[15, 5]]);
    const s = shiftGrid({ ...g, angleDeg: 90 }, 3, 0);
    expect(s.originX).toBeCloseTo(5, 6);
    expect(s.originY).toBeCloseTo(8, 6);
    const lines = gridLines(g, square(100));
    // ขอบรวมครึ่งช่อง (−5…105) → เส้นที่ −5, 5, …, 105 = 12 เส้น
    expect(lines.filter((l) => l[2] === 'v')).toHaveLength(12);
  });
});
