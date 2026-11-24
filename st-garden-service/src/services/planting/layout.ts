// วางแผนปลูก: ตีตารางตามแนวขอบแปลงแล้วได้ตำแหน่งต้นไม้เป็น [lng, lat] (port จากสคริปต์ Colab ของผู้ใช้)
// - คำนวณบน UTM (เมตร) เสมอ ไม่คำนวณจากองศาตรง ๆ (CLAUDE.md)
// - แนวแถวขนานขอบด้านแรก (จุด 1→2) · เริ่มห่างขอบครึ่งระยะปลูก · นับเฉพาะจุดที่อยู่ข้างในแปลง (ไม่รวมบนเส้นขอบ)
// - ใช้แกนกริดร่วม (../grid/core.ts) เหมือนนับต้นไม้จากภาพ — บนระนาบ (E, −N) หน่วยเมตร
// - ปรับเองได้ (editor): เลื่อนกริด (offset), หมุน (angleDeg), ระยะ, ลบหมุด (removed = ตำแหน่งบนพื้น), เพิ่มหมุดเอง (extras)
import { assignToGrid, awayFrom, frame, gridLines, intersectionsInside, type Grid } from '../grid/core';
import { polygonArea, type Pt } from '../tree-grid/geometry';
import { utmForward, utmInverse } from '../tree-grid/georef';

export const MAX_PLANNED_TREES = 20_000;
/** หมุดตามกริดที่อยู่ใกล้ตำแหน่งที่ลบไว้กว่า (สัดส่วนของระยะปลูก) ถือว่าถูกลบ — ค่าเดียวกับแกนกริดร่วม */
export { SAME_SLOT_FRACTION as REMOVED_MATCH_FRACTION } from '../grid/core';

export interface PlantingLayoutInput {
  /** มุมแปลง [lng, lat] ≥ 3 จุด (ไม่ต้องปิดวง) */
  boundary: readonly Pt[];
  /** ระยะปลูก (เมตร) — ตารางสี่เหลี่ยมจัตุรัส */
  spacingM: number;
  /** มุมแนวแถวจากทิศตะวันออก ทวนเข็ม (องศา, บน UTM) · ไม่ส่ง = ขนานขอบด้านแรก */
  angleDeg?: number;
  /** เลื่อนกริด [ตามแนวแถว, ตั้งฉาก (+ = ขึ้น)] เมตร · ไม่ส่ง = [0, 0] */
  offsetM?: readonly [number, number];
  /** ตำแหน่ง [lng, lat] ของหมุดตามกริดที่ผู้ใช้ลบ */
  removed?: readonly Pt[];
  /** หมุดที่ผู้ใช้เพิ่มเอง [lng, lat] (ไม่ขยับตามกริด) */
  extras?: readonly Pt[];
}

export interface PlannedTree {
  treeId: string;
  orderNum: number;
  /** แถว/คอลัมน์ = จุดตัดกริดที่ใกล้สุด (เริ่ม 1 จากมุมบนซ้ายของกรอบที่หมุนแล้ว — ช่องที่อยู่นอกแปลงข้ามเลข) */
  row: number;
  column: number;
  lngLat: [number, number];
  /** true = ผู้ใช้เพิ่มเอง */
  manual: boolean;
}

export interface PlantingLayout {
  utmEpsg: number;
  angleDeg: number;
  spacingM: number;
  offsetM: [number, number];
  /** พื้นที่แปลง (ตร.ม.) บน UTM */
  areaSqm: number;
  rowCount: number;
  trees: PlannedTree[];
  /** เส้นกริดครอบแปลง [[lng, lat], [lng, lat]] */
  gridLines: [[number, number], [number, number]][];
}

export class PlantingError extends Error {
  constructor(readonly code: 'BOUNDARY_TOO_FEW_POINTS' | 'BOUNDARY_OUT_OF_RANGE' | 'BOUNDARY_TOO_SMALL' | 'TOO_MANY_TREES', message: string) {
    super(message);
  }
}

const tooMany = () =>
  new PlantingError('TOO_MANY_TREES', `จุดปลูกมากเกินไป (เกิน ${MAX_PLANNED_TREES.toLocaleString('th-TH')} ต้น) — เพิ่มระยะปลูกหรือแบ่งแปลง`);

export function planPlantingLayout(input: PlantingLayoutInput): PlantingLayout {
  const { boundary, spacingM: s } = input;
  if (boundary.length < 3) throw new PlantingError('BOUNDARY_TOO_FEW_POINTS', 'ต้องปักมุมแปลงอย่างน้อย 3 จุด');
  for (const [lng, lat] of [...boundary, ...(input.removed ?? []), ...(input.extras ?? [])]) {
    if (!(lng >= -180 && lng <= 180 && lat >= 0 && lat <= 84)) {
      throw new PlantingError('BOUNDARY_OUT_OF_RANGE', 'พิกัดต้องเป็น [lng, lat] ในซีกโลกเหนือ');
    }
  }
  const meanLng = boundary.reduce((sum, p) => sum + p[0], 0) / boundary.length;
  const zone = Math.min(60, Math.floor((meanLng + 180) / 6) + 1);
  // ระนาบของแกนกริดร่วม (x ขวา, y ลง) = (E, −N)
  const toPlane = (p: Pt): Pt => {
    const [e, n] = utmForward(p, zone);
    return [e, -n];
  };
  const toLngLat = ([x, y]: Pt): [number, number] => {
    const [lng, lat] = utmInverse([x, -y], zone);
    return [round7(lng), round7(lat)];
  };
  const poly = boundary.map(toPlane);
  const areaSqm = polygonArea(poly);
  if (areaSqm < 1) throw new PlantingError('BOUNDARY_TOO_SMALL', 'แปลงเล็กเกินไป');

  // มุมแนวแถวบน UTM (ทวนเข็มจากทิศตะวันออก) — ค่าเริ่มต้นขนานขอบแรก · บนระนาบ y ลง = −มุม
  const [p1, p2] = [poly[0]!, poly[1]!];
  const angle = input.angleDeg ?? (Math.atan2(-(p2[1] - p1[1]), p2[0] - p1[0]) * 180) / Math.PI;
  const [dx, dy] = input.offsetM ?? [0, 0];
  // จุดตัดอ้างอิง: มุมบนซ้ายของกรอบที่หมุนแล้ว ห่างขอบครึ่งระยะ (เหมือน Colab) + เลื่อน (dy บวก = ขึ้น)
  const f = frame(-angle);
  const r = f.range(poly);
  const [ox, oy] = f.toXY([r.uMin + s / 2 + dx, r.vMin + s / 2 - dy]);
  const grid: Grid = { angleDeg: -angle, spacing: s, originX: ox, originY: oy };

  const slots = intersectionsInside(grid, poly, MAX_PLANNED_TREES);
  if (!slots) throw tooMany();
  const kept = awayFrom(slots, (input.removed ?? []).map(toPlane), s);
  const extras = input.extras ?? [];
  const pts: Pt[] = [...kept, ...extras.map(toPlane)];
  if (pts.length > MAX_PLANNED_TREES) throw tooMany();

  const { order, row, col, rowCount } = pts.length
    ? assignToGrid(pts, grid, poly)
    : { order: [] as number[], row: [] as number[], col: [] as number[], rowCount: 0 };
  const trees: PlannedTree[] = order.map((i, k) => {
    const manual = i >= kept.length;
    const src = manual ? extras[i - kept.length]! : null;
    return {
      treeId: `TREE_${String(k + 1).padStart(3, '0')}`,
      orderNum: k + 1,
      row: row[i]!,
      column: col[i]!,
      // หมุดที่เพิ่มเองคืนพิกัดเดิมของผู้ใช้ (ไม่ผ่านการแปลงไป-กลับ)
      lngLat: src ? [round7(src[0]), round7(src[1])] : toLngLat(pts[i]!),
      manual,
    };
  });

  return {
    utmEpsg: 32600 + zone,
    angleDeg: Math.round(angle * 10000) / 10000,
    spacingM: s,
    offsetM: [Math.round(dx * 1000) / 1000, Math.round(dy * 1000) / 1000],
    areaSqm: Math.round(areaSqm * 100) / 100,
    rowCount,
    trees,
    gridLines: gridLines(grid, poly).map(([a, b]) => [toLngLat(a), toLngLat(b)]),
  };
}

function round7(x: number): number {
  return Number(x.toFixed(7));
}
