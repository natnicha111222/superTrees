// decode ภาพที่ผู้ใช้อัปโหลด → ภาพขาวดำสำหรับ tree-grid / ขนาดภาพ (หลังหมุนตาม EXIF)
import sharp, { type Metadata } from 'sharp';
import { TREE_SURVEY_MAX_IMAGE_SIDE_PX } from '@supertrees/contracts';
import { AppError } from '../errors';
import { toGray, type GrayImage } from './tree-grid';

/** ตรวจชนิด/ขนาดจากเนื้อไฟล์ (ไม่เชื่อนามสกุล/content-type) */
async function checkedMetadata(bytes: Uint8Array): Promise<Metadata> {
  let meta: Metadata;
  try {
    // limitInputPixels กันภาพระเบิดหน่วยความจำก่อนเช็กขนาด
    meta = await sharp(bytes, { limitInputPixels: 64_000_000 }).metadata();
  } catch {
    throw new AppError(400, 'IMAGE_INVALID', 'ไฟล์ไม่ใช่ภาพที่อ่านได้');
  }
  if (meta.format !== 'jpeg' && meta.format !== 'png') {
    throw new AppError(400, 'IMAGE_INVALID', 'รองรับเฉพาะ JPEG / PNG');
  }
  if (Math.max(meta.width ?? 0, meta.height ?? 0) > TREE_SURVEY_MAX_IMAGE_SIDE_PX) {
    throw new AppError(400, 'IMAGE_TOO_LARGE', `ด้านยาวของภาพต้องไม่เกิน ${TREE_SURVEY_MAX_IMAGE_SIDE_PX} พิกเซล`);
  }
  return meta;
}

export async function decodeSurveyImage(bytes: Uint8Array): Promise<GrayImage> {
  await checkedMetadata(bytes);
  // .rotate() = หมุนตาม EXIF ให้พิกัดตรงกับภาพที่เบราว์เซอร์แสดง
  const { data, info } = await sharp(bytes).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return toGray(data, info.width, info.height, info.channels as 3 | 4);
}

/** ขนาดภาพตามที่เบราว์เซอร์แสดง (สลับกว้าง/สูงถ้า EXIF หมุน 90°) — ไม่ decode ทั้งภาพ */
export async function surveyImageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const meta = await checkedMetadata(bytes);
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  return (meta.orientation ?? 1) >= 5 ? { width: h, height: w } : { width: w, height: h };
}
