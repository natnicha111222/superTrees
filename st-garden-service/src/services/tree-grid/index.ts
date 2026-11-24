// นับต้นไม้ + จัดแถวจากภาพถ่ายมุมสูงของแปลง (port จากสคริปต์ Colab — ดู TASK-010)
// ทำงานบนพิกัดพิกเซลของภาพ · แปลงเป็นพิกัดแผนที่ (SRID 4326) ด้วย georef จากจุดคู่ (CONF-005)

import { crop, gaussianBlur, minimumFilter, type GrayImage } from './image';
import { detectDarkBlobs, DEFAULT_BLOB_PARAMS, type BlobParams } from './blobs';
import { pointInPolygon, type Pt } from './geometry';
import { PointGrid } from './spatial';
import { buildTreeGrid, type GridParams, type ScaleInput, type TreeGrid } from './grid';

export type { GrayImage } from './image';
export { toGray } from './image';
export type { Pt } from './geometry';
export type { BuildOptions, GridLine, GridParams, GridTree, ScaleInput, TreeGrid } from './grid';
export { autoGridParams, buildTreeGrid, GridError, gridGapPoints, MIN_TREES_FOR_GRID, resolveGridParams } from './grid';
export { fitGeoref, GeorefError, type ControlPoint, type Georef } from './georef';

export interface TreeGridOptions {
  scale: ScaleInput;
  blob?: Partial<BlobParams>;
  /** ถ้า blob detector เจอน้อยกว่านี้ ให้หาจุดต่ำสุดเฉพาะที่เพิ่ม (ต้นฉบับ: 20) */
  fallbackBelow?: number;
  /** จุดต่ำสุดเฉพาะที่ต้องมืดกว่านี้ (ต้นฉบับ: 115) */
  fallbackMaxGray?: number;
  /** ขนาดหน้าต่างหาจุดต่ำสุดเฉพาะที่ (ต้นฉบับ: 13) */
  fallbackWindow?: number;
  /** จุดที่ใกล้กันกว่านี้ถือเป็นต้นเดียวกัน (ต้นฉบับ: 12 px) */
  minTreeDistancePx?: number;
  /** ค่ากริดที่กำหนดเอง (ไม่ส่ง = อัตโนมัติ) */
  grid?: Partial<GridParams> | null;
}

export type TreeGridErrorCode = 'IMAGE_TOO_LARGE' | 'BOUNDARY_TOO_FEW_POINTS' | 'BOUNDARY_OUTSIDE_IMAGE' | 'TOO_FEW_TREES';

/**
 * CONF-005 ทางเลือก A: ประมวลผลแบบ sync ที่หลังบ้าน จึงจำกัดด้านยาวของภาพ
 * (4000×3000 ≈ 5.4 วินาทีบนเครื่อง dev — TASK-010) · ภาพใหญ่กว่านี้ให้หน้าบ้านย่อก่อนอัปโหลด
 */
export const MAX_IMAGE_SIDE_PX = 4096;

export class TreeGridError extends Error {
  constructor(readonly code: TreeGridErrorCode, message: string) {
    super(message);
  }
}

export interface TreeGridResult extends TreeGrid {
  detection: { method: 'blob' | 'blob+local-min'; candidateCount: number };
}

const CROP_MARGIN = 16; // > ครึ่งหนึ่งของ kernel blur (4) และ min filter (6) — ขอบที่ crop ไม่กระทบผล

export function analyzeTreeGrid(img: GrayImage, boundary: readonly Pt[], options: TreeGridOptions): TreeGridResult {
  if (Math.max(img.width, img.height) > MAX_IMAGE_SIDE_PX) {
    throw new TreeGridError('IMAGE_TOO_LARGE', `ภาพใหญ่เกินไป (ด้านยาวต้องไม่เกิน ${MAX_IMAGE_SIDE_PX} พิกเซล)`);
  }
  if (boundary.length < 3) {
    throw new TreeGridError('BOUNDARY_TOO_FEW_POINTS', 'ต้องเลือกขอบเขตแปลงอย่างน้อย 3 จุด');
  }
  const params = { ...DEFAULT_BLOB_PARAMS, ...options.blob };
  const fallbackBelow = options.fallbackBelow ?? 20;
  const fallbackMaxGray = options.fallbackMaxGray ?? 115;
  const fallbackWindow = options.fallbackWindow ?? 13;
  const minTreeDist = options.minTreeDistancePx ?? 12;

  // ประมวลผลเฉพาะกรอบของขอบเขตแปลง (เร็วกว่าทั้งภาพมาก)
  const xs = boundary.map((p) => p[0]);
  const ys = boundary.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - CROP_MARGIN);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - CROP_MARGIN);
  const x1 = Math.min(img.width, Math.ceil(Math.max(...xs)) + CROP_MARGIN + 1);
  const y1 = Math.min(img.height, Math.ceil(Math.max(...ys)) + CROP_MARGIN + 1);
  if (x1 <= x0 || y1 <= y0) {
    throw new TreeGridError('BOUNDARY_OUTSIDE_IMAGE', 'ขอบเขตแปลงอยู่นอกภาพ');
  }
  const gray = crop(img, x0, y0, x1 - x0, y1 - y0);
  const blurred = gaussianBlur(gray, 9, 2);
  const inside = (p: Pt) => pointInPolygon(p, boundary);

  const candidates: Pt[] = detectDarkBlobs(blurred, params)
    .map(([x, y]) => [Math.trunc(x) + x0, Math.trunc(y) + y0] as const)
    .filter(inside);

  let method: TreeGridResult['detection']['method'] = 'blob';
  if (candidates.length < fallbackBelow) {
    method = 'blob+local-min';
    const minF = minimumFilter(blurred, fallbackWindow);
    for (let y = 0; y < blurred.height; y++) {
      for (let x = 0; x < blurred.width; x++) {
        const i = y * blurred.width + x;
        if (minF.data[i] !== blurred.data[i] || gray.data[i]! >= fallbackMaxGray) continue;
        const p: Pt = [x + x0, y + y0];
        if (inside(p)) candidates.push(p);
      }
    }
  }

  // ตัดจุดซ้ำ: เก็บจุดแรก ทิ้งจุดที่ใกล้กว่า minTreeDist (ต้นฉบับใช้ > จึงทิ้งที่ระยะ = ด้วย)
  const trees: Pt[] = [];
  const kept = new PointGrid<{ x: number; y: number }>(minTreeDist + 1);
  for (const p of candidates) {
    if (kept.findWithin(p[0], p[1], minTreeDist + 1e-9)) continue;
    trees.push(p);
    kept.add({ x: p[0], y: p[1] });
  }
  if (trees.length < 4) {
    throw new TreeGridError('TOO_FEW_TREES', `ตรวจพบต้นไม้ ${trees.length} ต้น — น้อยเกินไปสำหรับการจัดแถว (ต้องมีอย่างน้อย 4)`);
  }

  return {
    ...buildTreeGrid(trees, options.scale, { grid: options.grid, extent: boundary }),
    detection: { method, candidateCount: candidates.length },
  };
}
