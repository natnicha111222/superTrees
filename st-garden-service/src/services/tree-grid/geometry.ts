// เรขาคณิตบนพิกัดพิกเซลของภาพ (ไม่ใช่พิกัดภูมิศาสตร์) — แทน cv2.pointPolygonTest / minAreaRect

export type Pt = readonly [number, number];

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** convex hull แบบ monotone chain — คืนจุดเรียงทวนเข็ม ไม่ซ้ำจุดแรก */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function polygonArea(poly: readonly Pt[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  }
  return Math.abs(s) / 2;
}

/** อยู่ในหรือบนขอบ polygon (เหมือน pointPolygonTest(...) >= 0) · includeEdge=false = ต้องอยู่ข้างในจริง */
export function pointInPolygon(p: Pt, poly: readonly Pt[], includeEdge = true): boolean {
  const [x, y] = p;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    // บนขอบ
    const crossV = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(crossV) < 1e-9 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) {
      return includeEdge;
    }
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface MinAreaRect {
  /** มุมของด้านที่ใกล้แนวนอนที่สุด (เรเดียน) อยู่ในช่วง (-π/4, π/4] */
  angle: number;
  /** ขนาดตามแกนที่หมุนแล้ว */
  width: number;
  height: number;
  /** มุมซ้ายบนของกรอบในระบบพิกัดที่หมุนด้วย -angle แล้ว */
  minU: number;
  minV: number;
}

/** สี่เหลี่ยมพื้นที่น้อยที่สุดที่ครอบจุด (rotating calipers บนขอบของ hull) */
export function minAreaRect(points: readonly Pt[]): MinAreaRect {
  const hull = convexHull(points);
  const candidates: number[] = [0];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    if (a[0] !== b[0] || a[1] !== b[1]) candidates.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
  }
  let best: MinAreaRect | null = null;
  let bestArea = Infinity;
  for (const raw of candidates) {
    const angle = normalizeQuarter(raw);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c + y * s;
      const v = -x * s + y * c;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea - 1e-9) {
      bestArea = area;
      best = { angle, width: maxU - minU, height: maxV - minV, minU, minV };
    }
  }
  return best!;
}

/** มุมของเส้นตรง (ไม่สนทิศ และกรอบสี่เหลี่ยมหมุน 90° ได้) → ช่วง (-π/4, π/4] */
function normalizeQuarter(a: number): number {
  const q = Math.PI / 2;
  let r = a % q;
  if (r > q / 2) r -= q;
  if (r <= -q / 2) r += q;
  return r;
}
