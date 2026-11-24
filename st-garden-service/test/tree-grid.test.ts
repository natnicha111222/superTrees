import { describe, expect, test } from 'bun:test';
import { analyzeTreeGrid, TreeGridError, type GrayImage, type Pt } from '../src/services/tree-grid';
import { minAreaRect, pointInPolygon } from '../src/services/tree-grid/geometry';
import { fitGeoref, GeorefError, utmForward, utmInverse, type ControlPoint } from '../src/services/tree-grid/georef';

/** ภาพจำลอง: พื้นสว่าง + ทรงพุ่มมืดรัศมี r เรียงตาราง cols×rows ระยะ spacing px หมุน angleDeg */
function synthPlot(opts: { cols: number; rows: number; spacing: number; angleDeg: number; r?: number; extra?: Pt[] }) {
  const w = 520, h = 420, r = opts.r ?? 6;
  const data = new Uint8Array(w * h).fill(200);
  const a = (opts.angleDeg * Math.PI) / 180;
  const ox = 110, oy = 90;
  const centers: Pt[] = [];
  for (let j = 0; j < opts.rows; j++) {
    for (let i = 0; i < opts.cols; i++) {
      const u = i * opts.spacing, v = j * opts.spacing;
      centers.push([ox + u * Math.cos(a) - v * Math.sin(a), oy + u * Math.sin(a) + v * Math.cos(a)]);
    }
  }
  for (const [cx, cy] of [...centers, ...(opts.extra ?? [])]) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) data[y * w + x] = 40;
      }
    }
  }
  const img: GrayImage = { width: w, height: h, data };
  return { img, centers };
}

const boundaryAround = (pts: Pt[], pad: number): Pt[] => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
};

describe('analyzeTreeGrid', () => {
  test('นับต้นไม้ครบ จัดแถวถูก ตารางเอียง 10°', () => {
    const { img, centers } = synthPlot({ cols: 8, rows: 6, spacing: 34, angleDeg: 10 });
    const res = analyzeTreeGrid(img, boundaryAround(centers, 15), { scale: { kind: 'none' } });

    expect(res.stats.treeCount).toBe(48);
    expect(res.stats.rowCount).toBe(6);
    expect(res.stats.medianSpacingPx).toBeCloseTo(34, 0);
    expect(res.stats.gridAngleDeg).toBeCloseTo(10, 0);
    expect(res.detection.method).toBe('blob');

    // ต้นที่ตรวจพบตรงกับต้นจริง (คลาดไม่เกิน 2 px)
    for (const t of res.trees) {
      const nearest = Math.min(...centers.map(([x, y]) => Math.hypot(x - t.pixelX, y - t.pixelY)));
      expect(nearest).toBeLessThan(2);
    }
    // ลำดับ: แถวละ 8 ต้น เรียงซ้ายไปขวา · เลขแถว/คอลัมน์ต่อเนื่อง
    // (เลขเริ่มนับจากแถว/คอลัมน์แรกที่มีช่องในขอบเขต — กรอบตั้งตรงครอบตารางเอียงจึงอาจมีช่องว่างก่อนต้นแรก)
    const r0 = res.trees[0]!.row;
    const c0 = res.trees[0]!.column;
    expect(r0).toBeGreaterThanOrEqual(1);
    for (const t of res.trees) {
      expect(t.row).toBe(r0 + Math.floor((t.orderNum - 1) / 8));
      expect(t.column).toBe(c0 + ((t.orderNum - 1) % 8));
    }
    expect(res.trees[0]!.treeId).toBe('T_001');
    expect(res.gridLines.some((l) => l.orientation === 'v')).toBe(true);
    expect(res.gridLines.some((l) => l.orientation === 'h')).toBe(true);
  });

  test('ตัดต้นที่อยู่นอกขอบเขตแปลงทิ้ง', () => {
    const { img, centers } = synthPlot({ cols: 6, rows: 5, spacing: 34, angleDeg: 0, extra: [[40, 40], [480, 380]] });
    const res = analyzeTreeGrid(img, boundaryAround(centers, 15), { scale: { kind: 'none' } });
    expect(res.stats.treeCount).toBe(30);
  });

  test('มาตราส่วน: ระบุ m/px ได้ระยะจริง · แบบสมมติระยะปลูกได้ค่าเท่าที่สมมติ', () => {
    const { img, centers } = synthPlot({ cols: 6, rows: 5, spacing: 40, angleDeg: -20 });
    const b = boundaryAround(centers, 15);

    const given = analyzeTreeGrid(img, b, { scale: { kind: 'metersPerPixel', metersPerPixel: 0.1 } });
    expect(given.stats.meanNearestDistanceM!).toBeCloseTo(4, 0);
    expect(given.stats.gridAngleDeg).toBeCloseTo(-20, 0);

    const assumed = analyzeTreeGrid(img, b, { scale: { kind: 'assumedSpacing', spacingM: 4 } });
    expect(assumed.stats.scaleSource).toBe('assumedSpacing');
    expect(assumed.stats.scaleIsEstimate).toBe(true);
    expect(assumed.stats.meanNearestDistanceM!).toBeCloseTo(4, 1);

    const none = analyzeTreeGrid(img, b, { scale: { kind: 'none' } });
    expect(none.stats.metersPerPixel).toBeNull();
    expect(none.trees[0]!.nearestDistanceM).toBeNull();
  });

  test('error: ขอบเขตไม่ถึง 3 จุด / ต้นไม้น้อยเกินไป', () => {
    const { img } = synthPlot({ cols: 2, rows: 1, spacing: 40, angleDeg: 0 });
    expect(() => analyzeTreeGrid(img, [[0, 0], [10, 10]], { scale: { kind: 'none' } })).toThrow(TreeGridError);
    try {
      analyzeTreeGrid(img, [[60, 50], [250, 50], [250, 150], [60, 150]], { scale: { kind: 'none' } });
      throw new Error('ควร throw');
    } catch (e) {
      expect((e as TreeGridError).code).toBe('TOO_FEW_TREES');
    }
  });
});

describe('geometry', () => {
  test('pointInPolygon รวมจุดบนขอบ', () => {
    const sq: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon([5, 5], sq)).toBe(true);
    expect(pointInPolygon([10, 5], sq)).toBe(true);
    expect(pointInPolygon([11, 5], sq)).toBe(false);
    expect(pointInPolygon([10, 5], sq, false)).toBe(false);
    expect(pointInPolygon([5, 5], sq, false)).toBe(true);
  });

  test('minAreaRect มุมอยู่ในช่วง (-45°, 45°]', () => {
    const a = (40 * Math.PI) / 180;
    const pts: Pt[] = [[0, 0], [100, 0], [100, 30], [0, 30]].map(([x, y]) => [x! * Math.cos(a) - y! * Math.sin(a), x! * Math.sin(a) + y! * Math.cos(a)]);
    const r = minAreaRect(pts);
    expect((r.angle * 180) / Math.PI).toBeCloseTo(40, 3);
    expect(r.width * r.height).toBeCloseTo(3000, 3);
  });
});

describe('georef (CONF-005 ทางเลือก B)', () => {
  test('UTM ไป-กลับ ได้พิกัดเดิม (โซน 47 และ 48)', () => {
    for (const [p, zone] of [[[100.5018, 13.7563], 47], [[98.9853, 18.7883], 47], [[104.8, 15.2], 48]] as const) {
      const back = utmInverse(utmForward(p, zone), zone);
      expect(back[0]).toBeCloseTo(p[0], 8);
      expect(back[1]).toBeCloseTo(p[1], 8);
    }
  });

  test('ระยะบน UTM สมเหตุสมผล: 0.01° ละติจูดที่ 13.75°N ≈ 1,106 ม.', () => {
    const a = utmForward([100.5, 13.75], 47);
    const b = utmForward([100.5, 13.76], 47);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(1105.5);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1107);
  });

  // ภาพจำลอง: 0.1 ม./px หมุน 30° มุมซ้ายบนของภาพอยู่ที่ UTM 47N (660000, 1520000)
  const truth = (x: number, y: number): Pt => {
    const a = (30 * Math.PI) / 180, m = 0.1;
    return [660000 + m * (x * Math.cos(a) + y * Math.sin(a)), 1520000 + m * (x * Math.sin(a) - y * Math.cos(a))];
  };
  const cp = (x: number, y: number): ControlPoint => ({ pixel: [x, y], lngLat: utmInverse(truth(x, y), 47) });

  test('fit จากจุดคู่ 4 จุด ได้ m/px และตำแหน่งถูก', () => {
    const g = fitGeoref([cp(0, 0), cp(500, 0), cp(500, 400), cp(0, 400)]);
    expect(g.epsg).toBe(32647);
    expect(g.metersPerPixel).toBeCloseTo(0.1, 6);
    expect(g.rmsErrorM).toBeLessThan(0.01);
    const [lng, lat] = g.pixelToLngLat([250, 200]);
    const [tl, tt] = utmInverse(truth(250, 200), 47);
    expect(lng).toBeCloseTo(tl, 7);
    expect(lat).toBeCloseTo(tt, 7);
  });

  test('error: น้อยกว่า 3 จุด / อยู่แนวเดียวกัน', () => {
    expect(() => fitGeoref([cp(0, 0), cp(10, 10)])).toThrow(GeorefError);
    try {
      fitGeoref([cp(0, 0), cp(100, 100), cp(200, 200)]);
      throw new Error('ควร throw');
    } catch (e) {
      expect((e as GeorefError).code).toBe('CONTROL_POINTS_COLLINEAR');
    }
  });

  test('analyzeTreeGrid + georef: ได้ระยะจริงและ [lng, lat] ของทุกต้น', () => {
    const { img, centers } = synthPlot({ cols: 6, rows: 5, spacing: 40, angleDeg: 0 });
    const georef = fitGeoref([cp(0, 0), cp(520, 0), cp(520, 420), cp(0, 420)]);
    const res = analyzeTreeGrid(img, boundaryAround(centers, 15), { scale: { kind: 'georef', georef } });
    expect(res.stats.scaleSource).toBe('georef');
    expect(res.stats.scaleIsEstimate).toBe(false);
    expect(res.stats.georef?.epsg).toBe(32647);
    expect(res.stats.meanNearestDistanceM!).toBeCloseTo(4, 0);
    for (const t of res.trees) {
      expect(t.lngLat).not.toBeNull();
      expect(t.lngLat![0]).toBeGreaterThan(100);
      expect(t.lngLat![1]).toBeGreaterThan(13);
    }
  });
});

describe('ขีดจำกัดภาพ (CONF-005 ทางเลือก A)', () => {
  test('ด้านยาวเกิน 4096 px → IMAGE_TOO_LARGE', () => {
    const img: GrayImage = { width: 4097, height: 10, data: new Uint8Array(4097 * 10) };
    try {
      analyzeTreeGrid(img, [[0, 0], [5, 0], [5, 5]], { scale: { kind: 'none' } });
      throw new Error('ควร throw');
    } catch (e) {
      expect((e as TreeGridError).code).toBe('IMAGE_TOO_LARGE');
    }
  });
});
