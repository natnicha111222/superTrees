// เตรียมภาพก่อนอัปโหลด — CONF-005: ด้านยาว ≤ 4096 px (หลังบ้านประมวลผลแบบ sync)
import {
  TREE_SURVEY_IMAGE_TYPES,
  TREE_SURVEY_MAX_FILE_BYTES,
  TREE_SURVEY_MAX_IMAGE_SIDE_PX,
  type TreeSurveyImageType,
} from '@supertrees/contracts';

export interface PreparedImage {
  blob: Blob;
  contentType: TreeSurveyImageType;
  width: number;
  height: number;
  resized: boolean;
}

export async function prepareSurveyImage(file: File): Promise<PreparedImage> {
  if (!(TREE_SURVEY_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('รองรับเฉพาะภาพ JPEG / PNG');
  }
  // createImageBitmap หมุนตาม EXIF ให้แล้ว (เหมือนที่ <img> แสดง และเหมือนหลังบ้านที่ใช้ .rotate())
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;
  const scale = Math.min(1, TREE_SURVEY_MAX_IMAGE_SIDE_PX / Math.max(width, height));
  if (scale === 1 && file.size <= TREE_SURVEY_MAX_FILE_BYTES) {
    bmp.close();
    return { blob: file, contentType: file.type as TreeSurveyImageType, width, height, resized: false };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('ย่อภาพไม่สำเร็จ'))), 'image/jpeg', 0.9),
  );
  if (blob.size > TREE_SURVEY_MAX_FILE_BYTES) throw new Error('ภาพใหญ่เกินไปแม้ย่อแล้ว');
  return { blob, contentType: 'image/jpeg', width: w, height: h, resized: true };
}

/** "13.7563, 100.5018" (ละติจูด, ลองจิจูด — รูปแบบที่แอปแผนที่ส่วนใหญ่คัดลอกให้) → [lng, lat] */
export function parseLatLngText(text: string): [number, number] | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return [lng, lat];
}
