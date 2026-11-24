// หา "จุดมืดกลม ๆ" (ทรงพุ่มต้นไม้บนภาพถ่ายมุมสูง) — ทำตามขั้นตอนของ cv2.SimpleBlobDetector
// ค่าที่ได้ใกล้เคียงแต่ไม่ตรงกับ OpenCV ทุกพิกเซล (area/perimeter คิดจากพิกเซล ไม่ใช่จาก contour)

import type { GrayImage } from './image';
import { convexHull, polygonArea, type Pt } from './geometry';
import { PointGrid } from './spatial';

export interface BlobParams {
  minThreshold: number;
  maxThreshold: number;
  thresholdStep: number;
  minRepeatability: number;
  minDistBetweenBlobs: number;
  minArea: number;
  maxArea: number;
  minCircularity: number;
  minConvexity: number;
  minInertiaRatio: number;
}

/** threshold/repeat/dist = ค่า default ของ OpenCV · ที่เหลือ = ค่าจากสคริปต์ต้นฉบับ (Colab) */
export const DEFAULT_BLOB_PARAMS: BlobParams = {
  minThreshold: 50,
  maxThreshold: 220,
  thresholdStep: 10,
  minRepeatability: 2,
  minDistBetweenBlobs: 10,
  minArea: 30,
  maxArea: 600,
  minCircularity: 0.25,
  minConvexity: 0.3,
  minInertiaRatio: 0.2,
};

/** จุดศูนย์กลางของ blob สีเข้ม (blobColor = 0) */
export function detectDarkBlobs(img: GrayImage, params: BlobParams = DEFAULT_BLOB_PARAMS): Pt[] {
  type Group = { x: number; y: number; sumX: number; sumY: number; n: number };
  const groups: Group[] = [];
  // จับกลุ่มด้วยตำแหน่งแรกของกลุ่ม (ค่าเฉลี่ยขยับได้ไม่เกิน ~2 px จึงคลาดจาก OpenCV น้อยมาก)
  const index = new PointGrid<Group>(params.minDistBetweenBlobs);

  // จอง buffer ครั้งเดียว ใช้ซ้ำทุก threshold
  const buf: Buffers = {
    labels: new Int32Array(img.width * img.height),
    stack: new Int32Array(img.width * img.height),
    members: new Int32Array(params.maxArea + 1),
  };
  for (let t = params.minThreshold; t < params.maxThreshold; t += params.thresholdStep) {
    buf.labels.fill(0);
    for (const c of findBlobsAtThreshold(img, t, params, buf)) {
      let g = index.findWithin(c[0], c[1], params.minDistBetweenBlobs);
      if (!g) {
        g = { x: c[0], y: c[1], sumX: 0, sumY: 0, n: 0 };
        groups.push(g);
        index.add(g);
      }
      g.sumX += c[0];
      g.sumY += c[1];
      g.n++;
    }
  }
  return groups.filter((g) => g.n >= params.minRepeatability).map((g) => [g.sumX / g.n, g.sumY / g.n] as const);
}

interface Buffers {
  labels: Int32Array;
  stack: Int32Array;
  members: Int32Array;
}

function findBlobsAtThreshold(img: GrayImage, t: number, p: BlobParams, { labels, stack, members }: Buffers): Pt[] {
  const { width: w, height: h, data } = img;
  const out: Pt[] = [];
  let label = 0;

  for (let start = 0; start < data.length; start++) {
    if (labels[start] !== 0 || data[start]! > t) continue;
    label++;
    let count = 0;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    while (sp > 0) {
      const idx = stack[--sp]!;
      if (count <= p.maxArea) members[count] = idx;
      count++;
      const x = idx % w;
      const y = (idx - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= w) continue;
          const n = ny * w + nx;
          if (labels[n] === 0 && data[n]! <= t) {
            labels[n] = label;
            stack[sp++] = n;
          }
        }
      }
    }
    if (count < p.minArea || count > p.maxArea) continue;
    const center = measure(members.subarray(0, count), labels, label, w, h, p);
    if (center) out.push(center);
  }
  return out;
}

function measure(px: Int32Array, labels: Int32Array, label: number, w: number, h: number, p: BlobParams): Pt | null {
  const n = px.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, perimeter = 0;
  let minY = Infinity, maxY = -Infinity;
  for (const idx of px) {
    const x = idx % w;
    const y = (idx - x) / w;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    // ความยาวขอบ = จำนวนด้านของพิกเซลที่ติดกับนอก component
    if (x === 0 || labels[idx - 1] !== label) perimeter++;
    if (x === w - 1 || labels[idx + 1] !== label) perimeter++;
    if (y === 0 || labels[idx - w] !== label) perimeter++;
    if (y === h - 1 || labels[idx + w] !== label) perimeter++;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = sx / n;
  const cy = sy / n;

  const circularity = (4 * Math.PI * n) / (perimeter * perimeter);
  if (circularity < p.minCircularity) return null;

  const mu20 = sxx / n - cx * cx;
  const mu02 = syy / n - cy * cy;
  const mu11 = sxy / n - cx * cy;
  const denom = Math.sqrt((2 * mu11) ** 2 + (mu20 - mu02) ** 2);
  const inertia = denom > 1e-2 ? (mu20 + mu02 - denom) / (mu20 + mu02 + denom) : 1;
  if (inertia < p.minInertiaRatio) return null;

  // hull ของมุมพิกเซล: ใช้แค่พิกเซลซ้ายสุด/ขวาสุดของแต่ละแถวก็พอ
  const rows = maxY - minY + 1;
  const left = new Int32Array(rows).fill(w);
  const right = new Int32Array(rows).fill(-1);
  for (const idx of px) {
    const x = idx % w;
    const r = (idx - x) / w - minY;
    if (x < left[r]!) left[r] = x;
    if (x > right[r]!) right[r] = x;
  }
  const corners: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    if (right[r]! < 0) continue;
    const y = r + minY;
    corners.push([left[r]!, y], [left[r]!, y + 1], [right[r]! + 1, y], [right[r]! + 1, y + 1]);
  }
  const convexity = n / polygonArea(convexHull(corners));
  if (convexity < p.minConvexity) return null;

  return [cx, cy];
}
