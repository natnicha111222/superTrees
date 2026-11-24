// ผูกภาพกับแผนที่จากจุดคู่ (พิกเซล ↔ [lng, lat]) — CONF-005 ทางเลือก B
// ระยะ/มาตราส่วนคิดบน UTM (EPSG:326xx ซีกโลกเหนือ — ไทยคือ 32647/32648) ไม่คิดจากค่าองศาตรง ๆ
// ภาพต้องถ่ายตั้งฉาก (nadir) — affine ไม่แก้ความเอียงแบบ perspective และความสูงต่ำของพื้น

import type { Pt } from './geometry';

export interface ControlPoint {
  /** พิกัดพิกเซลบนภาพ [x, y] */
  pixel: Pt;
  /** พิกัดบนแผนที่ [lng, lat] (SRID 4326) */
  lngLat: Pt;
}

export interface Georef {
  /** EPSG ของ UTM ที่ใช้คำนวณ เช่น 32647 */
  epsg: number;
  /** ขนาดพิกเซลเฉลี่ยบนพื้น (ม./พิกเซล) = sqrt(|det| ของ affine) */
  metersPerPixel: number;
  /** ความคลาดเคลื่อน RMS ของจุดคู่หลัง fit (ม.) — 3 จุดพอดีจะได้ 0 เสมอ ควรใช้ ≥ 4 จุดถ้าอยากรู้ความแม่น */
  rmsErrorM: number;
  pixelToUtm(p: Pt): Pt;
  pixelToLngLat(p: Pt): Pt;
}

export class GeorefError extends Error {
  constructor(readonly code: 'CONTROL_POINTS_TOO_FEW' | 'CONTROL_POINTS_COLLINEAR' | 'CONTROL_POINTS_OUT_OF_RANGE', message: string) {
    super(message);
  }
}

export function fitGeoref(points: readonly ControlPoint[]): Georef {
  if (points.length < 3) {
    throw new GeorefError('CONTROL_POINTS_TOO_FEW', 'ต้องปักจุดคู่ภาพ↔แผนที่อย่างน้อย 3 จุด');
  }
  for (const { lngLat: [lng, lat] } of points) {
    if (!(lng >= -180 && lng <= 180 && lat >= 0 && lat <= 84)) {
      throw new GeorefError('CONTROL_POINTS_OUT_OF_RANGE', 'พิกัดต้องเป็น [lng, lat] ในซีกโลกเหนือ');
    }
  }
  const meanLng = points.reduce((s, p) => s + p.lngLat[0], 0) / points.length;
  const zone = Math.min(60, Math.floor((meanLng + 180) / 6) + 1);
  const utm = points.map((p) => utmForward(p.lngLat, zone));

  const ex = solveAffine(points.map((p) => p.pixel), utm.map((u) => u[0]));
  const ny = solveAffine(points.map((p) => p.pixel), utm.map((u) => u[1]));
  if (!ex || !ny) {
    throw new GeorefError('CONTROL_POINTS_COLLINEAR', 'จุดคู่อยู่แนวเดียวกัน — ปักให้กระจายรอบแปลง');
  }
  const pixelToUtm = ([x, y]: Pt): Pt => [ex[0] * x + ex[1] * y + ex[2], ny[0] * x + ny[1] * y + ny[2]];
  const det = ex[0] * ny[1] - ex[1] * ny[0];

  const sq = points.reduce((s, p, i) => {
    const [e, n] = pixelToUtm(p.pixel);
    return s + (e - utm[i]![0]) ** 2 + (n - utm[i]![1]) ** 2;
  }, 0);

  return {
    epsg: 32600 + zone,
    metersPerPixel: Math.sqrt(Math.abs(det)),
    rmsErrorM: Math.sqrt(sq / points.length),
    pixelToUtm,
    pixelToLngLat: (p) => utmInverse(pixelToUtm(p), zone),
  };
}

/** least squares: v ≈ a·x + b·y + c — คืน null ถ้าจุดอยู่แนวเดียวกัน */
function solveAffine(px: readonly Pt[], v: readonly number[]): [number, number, number] | null {
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, sxv = 0, syv = 0, sv = 0;
  px.forEach(([x, y], i) => {
    const val = v[i]!;
    sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n++;
    sxv += x * val; syv += y * val; sv += val;
  });
  const m = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const det3 = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const d = det3(m);
  // เทียบกับสเกลของข้อมูล กันกรณีเกือบแนวเดียวกัน
  const scale = (sxx + syy) ** 2 * n;
  if (Math.abs(d) <= 1e-9 * scale) return null;
  const rhs = [sxv, syv, sv];
  const col = (k: number) => m.map((row, i) => row.map((c, j) => (j === k ? rhs[i]! : c)));
  return [det3(col(0)) / d, det3(col(1)) / d, det3(col(2)) / d];
}

// ── UTM (WGS84) ตามอนุกรมของ Krüger ถึงพจน์ n³ — คลาดเคลื่อนระดับมิลลิเมตรภายในโซน ──
const A_WGS84 = 6378137;
const F_WGS84 = 1 / 298.257223563;
const K0 = 0.9996;
const E0 = 500000;
const N_ = F_WGS84 / (2 - F_WGS84);
const A_ = (A_WGS84 / (1 + N_)) * (1 + N_ ** 2 / 4 + N_ ** 4 / 64);
const ALPHA = [N_ / 2 - (2 * N_ ** 2) / 3 + (5 * N_ ** 3) / 16, (13 * N_ ** 2) / 48 - (3 * N_ ** 3) / 5, (61 * N_ ** 3) / 240];
const BETA = [N_ / 2 - (2 * N_ ** 2) / 3 + (37 * N_ ** 3) / 96, N_ ** 2 / 48 + N_ ** 3 / 15, (17 * N_ ** 3) / 480];
const DELTA = [2 * N_ - (2 * N_ ** 2) / 3 - 2 * N_ ** 3, (7 * N_ ** 2) / 3 - (8 * N_ ** 3) / 5, (56 * N_ ** 3) / 15];
const C_ = (2 * Math.sqrt(N_)) / (1 + N_);
const rad = Math.PI / 180;
const centralMeridian = (zone: number) => (zone * 6 - 183) * rad;

export function utmForward([lng, lat]: Pt, zone: number): Pt {
  const phi = lat * rad;
  const dl = lng * rad - centralMeridian(zone);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - C_ * Math.atanh(C_ * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl));
  const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let e = eta, n = xi;
  for (let j = 1; j <= 3; j++) {
    e += ALPHA[j - 1]! * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    n += ALPHA[j - 1]! * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
  }
  return [E0 + K0 * A_ * e, K0 * A_ * n];
}

export function utmInverse([easting, northing]: Pt, zone: number): Pt {
  const xi = northing / (K0 * A_);
  const eta = (easting - E0) / (K0 * A_);
  let xiP = xi, etaP = eta;
  for (let j = 1; j <= 3; j++) {
    xiP -= BETA[j - 1]! * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= BETA[j - 1]! * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += DELTA[j - 1]! * Math.sin(2 * j * chi);
  const lambda = centralMeridian(zone) + Math.atan2(Math.sinh(etaP), Math.cos(xiP));
  return [lambda / rad, phi / rad];
}
