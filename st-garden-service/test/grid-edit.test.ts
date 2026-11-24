// การปรับกริดเอง (editor ของ TASK-010): ค่ากริดกำหนดเอง, เติมจุดตามตาราง, ค่าอัตโนมัติบางส่วน
import { describe, expect, test } from 'bun:test';
import { autoGridParams, buildTreeGrid, GridError, gridGapPoints, resolveGridParams, type Pt } from '../src/services/tree-grid';

/** ตาราง cols×rows ระยะ s px เอียง angleDeg เริ่มที่ (100, 80) */
function lattice(cols: number, rows: number, s: number, angleDeg: number): Pt[] {
  const a = (angleDeg * Math.PI) / 180;
  const pts: Pt[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    pts.push([100 + i * s * Math.cos(a) - j * s * Math.sin(a), 80 + i * s * Math.sin(a) + j * s * Math.cos(a)]);
  }
  return pts;
}
const none = { kind: 'none' } as const;

describe('ค่ากริด', () => {
  test('อัตโนมัติ: มุม/ระยะ/origin ตรงกับตาราง', () => {
    const g = autoGridParams(lattice(6, 4, 30, 8));
    expect(g.angleDeg).toBeCloseTo(8, 3);
    expect(g.spacingPx).toBeCloseTo(30, 3);
    expect([g.originX, g.originY]).toEqual([100, 80]);
  });

  test('ส่งค่าบางส่วน → ที่เหลือใช้ค่าอัตโนมัติ · ค่าผิด → GRID_INVALID', () => {
    const pts = lattice(5, 3, 30, 0);
    const g = resolveGridParams(pts, { spacingPx: 60 });
    expect(g.spacingPx).toBe(60);
    expect(g.angleDeg).toBeCloseTo(0, 5);
    expect(() => resolveGridParams(pts, { angleDeg: 0, spacingPx: 0, originX: 0, originY: 0 })).toThrow(GridError);
  });

  test('ต้นไม้ไม่ถึง 2 ต้น → TOO_FEW_TREES', () => {
    expect(() => buildTreeGrid([[1, 1]], none)).toThrow(GridError);
  });

  test('เลื่อน origin ครึ่งช่อง → แถวเดิม แต่เส้นกริดย้าย', () => {
    const pts = lattice(5, 3, 30, 0);
    const base = buildTreeGrid(pts, none);
    const g = base.stats.grid;
    const shifted = buildTreeGrid(pts, none, { grid: { ...g, originX: g.originX + 6 } });
    expect(shifted.stats.rowCount).toBe(3);
    expect(shifted.trees.map((t) => t.treeId)).toEqual(base.trees.map((t) => t.treeId));
    const firstV = (r: typeof base) => r.gridLines.filter((l) => l.orientation === 'v').map((l) => l.x1).sort((a, b) => a - b);
    expect(firstV(shifted)[0]! - firstV(base)[0]!).toBeCloseTo(6, 1);
  });

  test('หมุนกริด → เส้นเอียงตาม แต่ตารางเดิมยังจัดแถวได้ถ้ามุมไม่มาก', () => {
    const pts = lattice(5, 3, 30, 0);
    const g = autoGridParams(pts);
    const r = buildTreeGrid(pts, none, { grid: { ...g, angleDeg: 2 } });
    expect(r.stats.gridAngleDeg).toBe(2);
    expect(r.stats.rowCount).toBe(3);
    const h = r.gridLines.find((l) => l.orientation === 'h')!;
    // พิกัดเส้นปัด 2 ตำแหน่ง → มุมที่คำนวณกลับคลาดได้ ~0.01°
    expect((Math.atan2(h.y2 - h.y1, h.x2 - h.x1) * 180) / Math.PI).toBeCloseTo(2, 1);
  });

  test('ระยะช่องสองเท่า → แถวลดลง · assumedSpacing ใช้ระยะช่องตาราง', () => {
    const pts = lattice(6, 4, 30, 0);
    const g = autoGridParams(pts);
    const r = buildTreeGrid(pts, { kind: 'assumedSpacing', spacingM: 4 }, { grid: { ...g, spacingPx: 60 } });
    expect(r.stats.rowCount).toBe(3); // แถว 0,2 → 0,1 · แถว 1,3 ปัดเป็น 1,2 (round half up)
    expect(r.stats.metersPerPixel).toBeCloseTo(4 / 60, 6);
  });
});

describe('เติมจุดตามตาราง', () => {
  test('ต้นที่หายไปถูกเติมกลับที่จุดตัดกริด · จุดที่มีอยู่แล้วไม่ซ้ำ · นอกขอบเขตไม่เติม', () => {
    const full = lattice(6, 4, 30, 5);
    const missing = new Set([3, 9, 20]);
    const pts = full.filter((_, i) => !missing.has(i));
    const g = autoGridParams(pts);
    const boundary: Pt[] = [[80, 50], [300, 50], [300, 220], [80, 220]].map(([x, y]) => [x!, y!]);
    // ขอบเขตครอบตารางทั้งหมด (ตารางเอียง 5° จึงขยายให้ครอบ)
    const big: Pt[] = [[60, 40], [320, 40], [320, 260], [60, 260]];
    const added = gridGapPoints(pts, g, big);
    // ทุกต้นที่หายต้องถูกเติม (ใกล้ไม่เกิน 1 px)
    for (const i of missing) {
      const [x, y] = full[i]!;
      expect(added.some(([ax, ay]) => Math.hypot(ax - x, ay - y) <= 1)).toBe(true);
    }
    // ไม่เติมทับต้นที่มีอยู่
    for (const [ax, ay] of added) {
      expect(pts.every(([x, y]) => Math.hypot(ax - x, ay - y) > 30 * 0.45)).toBe(true);
    }
    // ขอบเขตเล็ก → เติมได้น้อยกว่า
    expect(gridGapPoints(pts, g, boundary).length).toBeLessThanOrEqual(added.length);
  });
});
