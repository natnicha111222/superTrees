// แกนกริดร่วม — ใช้ทั้ง "นับต้นไม้จากภาพ" (หน่วยพิกเซล) และ "วางแผนปลูก" (หน่วยเมตรบน UTM)
// ระนาบ: x ไปขวา, y ลงล่าง (แบบภาพ) · วางแผนปลูกแปลง UTM เป็น (E, −N) ก่อนเรียก
// กติกาเดียวกันทั้งสองฟีเจอร์:
// - กริด = มุมแนวแถว + ระยะช่อง + จุดตัดอ้างอิง (origin)
// - แถว/คอลัมน์ = จุดตัดที่ใกล้สุด · เลข 1 = แถว/คอลัมน์แรกที่มีจุดตัดอยู่ในแปลงจริง (ช่องว่างในแปลงนับรวม)
// - เรียงลำดับ: แถวบนลงล่าง แล้วซ้ายไปขวาตามแนวแถว
// - จุดตัดในแปลง = อยู่ข้างในจริง (ไม่รวมบนเส้นขอบ) · "ใกล้กัน" = น้อยกว่า 0.45 ระยะช่อง
import { pointInPolygon, type Pt } from '../tree-grid/geometry';
import { PointGrid } from '../tree-grid/spatial';

export interface Grid {
  /** มุมแนวแถวเทียบแกน x (องศา, ตามเข็มบนระนาบ y ลง) */
  angleDeg: number;
  /** ระยะช่อง (หน่วยเดียวกับพิกัด) */
  spacing: number;
  /** จุดตัดอ้างอิง */
  originX: number;
  originY: number;
}

/** จุดที่ใกล้กันกว่าสัดส่วนนี้ของระยะช่อง = จุดเดียวกัน (เติมจุด/ลบหมุด) */
export const SAME_SLOT_FRACTION = 0.45;
const MAX_GRID_LINES = 2000;

/** ระบบพิกัดที่หมุนตามแนวกริด: u = แนวแถว (ซ้าย→ขวา), v = ตั้งฉาก (บน→ล่าง) */
export function frame(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    toUV: ([x, y]: Pt): Pt => [x * c + y * s, -x * s + y * c],
    toXY: ([u, v]: Pt): Pt => [u * c - v * s, u * s + v * c],
    range(pts: readonly Pt[]) {
      let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (const [x, y] of pts) {
        const u = x * c + y * s;
        const v = -x * s + y * c;
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
      return { uMin, uMax, vMin, vMax };
    },
  };
}

/** เลื่อนจุดตัดอ้างอิงตามแนวกริด (du ตามแถว, dv ตั้งฉาก — บวก = ลง) */
export function shiftGrid(g: Grid, du: number, dv: number): Grid {
  const f = frame(g.angleDeg);
  const [u0, v0] = f.toUV([g.originX, g.originY]);
  const [x, y] = f.toXY([u0 + du, v0 + dv]);
  return { ...g, originX: x, originY: y };
}

export interface Assigned {
  /** ดัชนีของจุดเดิม เรียงตามลำดับ (แถว แล้วตามแนวแถว) */
  order: number[];
  /** แถว/คอลัมน์ของจุดเดิม (เริ่ม 1) */
  row: number[];
  col: number[];
  rowCount: number;
}

/** ให้เลขแถว/คอลัมน์ + ลำดับ ตามกติการ่วม · extent = ขอบเขตแปลง (ไม่ส่ง = ใช้จุดเอง) */
export function assignToGrid(points: readonly Pt[], g: Grid, extent?: readonly Pt[]): Assigned {
  const f = frame(g.angleDeg);
  const s = g.spacing;
  const [u0, v0] = f.toUV([g.originX, g.originY]);
  const rel = points.map((p) => {
    const [u, v] = f.toUV(p);
    return [u - u0, v - v0] as const;
  });
  const rawRow = rel.map(([, dv]) => Math.round(dv / s));
  const rawCol = rel.map(([du]) => Math.round(du / s));
  // เลข 1 = แถว/คอลัมน์แรกที่มีจุดตัดอยู่ในแปลง (หรือจุดเองถ้าอยู่นอกนั้น เช่นหมุดเพิ่มเองนอกแปลง)
  let baseRow = Math.min(...rawRow);
  let baseCol = Math.min(...rawCol);
  if (extent && extent.length >= 3) {
    const slots = intersectionsInside(g, extent, 400_000);
    if (slots) {
      for (const p of slots) {
        const [u, v] = f.toUV(p);
        baseRow = Math.min(baseRow, Math.round((v - v0) / s));
        baseCol = Math.min(baseCol, Math.round((u - u0) / s));
      }
    } else {
      // แปลงใหญ่มาก — ใช้กรอบแทน
      const r = f.range(extent);
      baseRow = Math.min(baseRow, Math.ceil((r.vMin - v0) / s - 1e-9));
      baseCol = Math.min(baseCol, Math.ceil((r.uMin - u0) / s - 1e-9));
    }
  }
  const order = [...points.keys()].sort((a, b) => rawRow[a]! - rawRow[b]! || rel[a]![0] - rel[b]![0]);
  return {
    order,
    row: rawRow.map((x) => x - baseRow + 1),
    col: rawCol.map((x) => x - baseCol + 1),
    rowCount: new Set(rawRow).size,
  };
}

/** จุดตัดกริดทั้งหมดที่อยู่ข้างในขอบเขต (ไม่รวมบนเส้นขอบ) · เกิน limit → คืน null */
export function intersectionsInside(g: Grid, boundary: readonly Pt[], limit: number): Pt[] | null {
  const f = frame(g.angleDeg);
  const s = g.spacing;
  const [u0, v0] = f.toUV([g.originX, g.originY]);
  const r = f.range(boundary);
  const j0 = Math.ceil((r.uMin - u0) / s);
  const j1 = Math.floor((r.uMax - u0) / s);
  const k0 = Math.ceil((r.vMin - v0) / s);
  const k1 = Math.floor((r.vMax - v0) / s);
  if ((j1 - j0 + 1) * (k1 - k0 + 1) > limit * 20) return null;
  const out: Pt[] = [];
  for (let k = k0; k <= k1; k++) {
    for (let j = j0; j <= j1; j++) {
      const p = f.toXY([u0 + j * s, v0 + k * s]);
      if (!pointInPolygon(p, boundary, false)) continue;
      out.push(p);
      if (out.length > limit) return null;
    }
  }
  return out;
}

/** จุดใน candidates ที่ไม่มีจุดใน others ใกล้กว่า SAME_SLOT_FRACTION × ระยะช่อง */
export function awayFrom(candidates: readonly Pt[], others: readonly Pt[], spacing: number): Pt[] {
  const d = spacing * SAME_SLOT_FRACTION;
  const idx = new PointGrid<{ x: number; y: number }>(Math.max(1e-6, d));
  for (const [x, y] of others) idx.add({ x, y });
  return candidates.filter(([x, y]) => !idx.findWithin(x, y, d));
}

/** เส้นกริดผ่าน origin ทุกระยะช่อง ครอบพื้นที่ extent (+ครึ่งช่อง) */
export function gridLines(g: Grid, extent: readonly Pt[]): [Pt, Pt, 'v' | 'h'][] {
  const f = frame(g.angleDeg);
  const s = g.spacing;
  const [u0, v0] = f.toUV([g.originX, g.originY]);
  const pad = s / 2;
  const r = f.range(extent);
  const [uMin, uMax, vMin, vMax] = [r.uMin - pad, r.uMax + pad, r.vMin - pad, r.vMax + pad];
  const lines: [Pt, Pt, 'v' | 'h'][] = [];
  for (let j = Math.ceil((uMin - u0) / s); u0 + j * s <= uMax && lines.length < MAX_GRID_LINES; j++) {
    const u = u0 + j * s;
    lines.push([f.toXY([u, vMin]), f.toXY([u, vMax]), 'v']);
  }
  for (let k = Math.ceil((vMin - v0) / s); v0 + k * s <= vMax && lines.length < MAX_GRID_LINES; k++) {
    const v = v0 + k * s;
    lines.push([f.toXY([uMin, v]), f.toXY([uMax, v]), 'h']);
  }
  return lines;
}
