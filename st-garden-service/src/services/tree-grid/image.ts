// ภาพขาวดำ 1 channel + filter พื้นฐาน (แทน cv2.cvtColor / GaussianBlur / scipy minimum_filter)
// ไม่มี dependency — การ decode ไฟล์ภาพ (jpg/png) ทำที่ชั้นที่เรียก (TASK-010)

export interface GrayImage {
  width: number;
  height: number;
  /** ค่า 0–255 เรียงแถวละ width ตัว */
  data: Uint8Array;
}

/** RGB/RGBA → gray ด้วยสูตรเดียวกับ OpenCV (0.299R + 0.587G + 0.114B) */
export function toGray(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, channels: 3 | 4): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += channels) {
    data[i] = Math.round(0.299 * pixels[p]! + 0.587 * pixels[p + 1]! + 0.114 * pixels[p + 2]!);
  }
  return { width, height, data };
}

export function crop(img: GrayImage, x0: number, y0: number, w: number, h: number): GrayImage {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const src = (y0 + y) * img.width + x0;
    data.set(img.data.subarray(src, src + w), y * w);
  }
  return { width: w, height: h, data };
}

// ขอบแบบ BORDER_REFLECT_101 ของ OpenCV: dcb|abcd|cba
function reflect101(i: number, n: number): number {
  if (n === 1) return 0;
  while (i < 0 || i >= n) {
    if (i < 0) i = -i;
    if (i >= n) i = 2 * n - 2 - i;
  }
  return i;
}

// ขอบแบบ mode='reflect' ของ scipy: cba|abcd|dcb
function reflectSym(i: number, n: number): number {
  while (i < 0 || i >= n) {
    if (i < 0) i = -i - 1;
    if (i >= n) i = 2 * n - 1 - i;
  }
  return i;
}

function gaussianKernel(size: number, sigma: number): Float64Array {
  const k = new Float64Array(size);
  const half = (size - 1) / 2;
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - half;
    k[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += k[i]!;
  }
  for (let i = 0; i < size; i++) k[i]! /= sum;
  return k;
}

/** เทียบเท่า cv2.GaussianBlur(gray, (size, size), sigma) — แยกแกน x/y */
export function gaussianBlur(img: GrayImage, size = 9, sigma = 2): GrayImage {
  const { width: w, height: h, data } = img;
  const k = gaussianKernel(size, sigma);
  const half = (size - 1) / 2;
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < size; i++) s += k[i]! * data[row + reflect101(x + i - half, w)]!;
      tmp[row + x] = s;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < size; i++) s += k[i]! * tmp[reflect101(y + i - half, h) * w + x]!;
      out[y * w + x] = Math.min(255, Math.max(0, Math.round(s)));
    }
  }
  return { width: w, height: h, data: out };
}

/** เทียบเท่า scipy.ndimage.minimum_filter(img, footprint=ones((size,size))) */
export function minimumFilter(img: GrayImage, size: number): GrayImage {
  const { width: w, height: h, data } = img;
  const half = Math.floor(size / 2);
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let i = -half; i < size - half; i++) {
        const v = data[row + reflectSym(x + i, w)]!;
        if (v < m) m = v;
      }
      tmp[row + x] = m;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let i = -half; i < size - half; i++) {
        const v = tmp[reflectSym(y + i, h) * w + x]!;
        if (v < m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return { width: w, height: h, data: out };
}
