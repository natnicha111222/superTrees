// TASK-010 — นับต้นไม้ + จัดแถวจากภาพถ่ายมุมสูง · ตัดสินใจตาม CONF-005
import type { LngLat } from '../common.js';

/** [x, y] พิกัดพิกเซลบนภาพ (มุมซ้ายบน = 0,0) */
export type PixelPoint = [number, number];

/** CONF-005: ประมวลผลแบบ sync → จำกัดด้านยาวของภาพ หน้าบ้านต้องย่อก่อนอัปโหลด */
export const TREE_SURVEY_MAX_IMAGE_SIDE_PX = 4096;
export const TREE_SURVEY_MAX_FILE_BYTES = 20 * 1024 * 1024;
/** จำนวนต้นสูงสุดที่ส่งมาแก้ไขได้ต่อครั้ง */
export const TREE_SURVEY_MAX_TREES = 20_000;
export const TREE_SURVEY_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
export type TreeSurveyImageType = (typeof TREE_SURVEY_IMAGE_TYPES)[number];

export interface TreeSurveyUploadUrlRequest {
  contentType: TreeSurveyImageType;
  sizeBytes: number;
}

export interface TreeSurveyUploadUrlResponse {
  /** object path ใน bucket — ส่งกลับมาตอนสร้าง survey */
  objectPath: string;
  /** signed upload URL (PUT ไฟล์ตรงไป Supabase Storage) อายุสั้น */
  uploadUrl: string;
}

export interface ControlPointDto {
  pixel: PixelPoint;
  lngLat: LngLat;
}

export interface TreeSurveyCreateRequest {
  objectPath: string;
  /** ขอบเขตแปลงบนภาพ ≥ 3 จุด */
  boundaryPx: PixelPoint[];
  /** จุดคู่ภาพ↔แผนที่ ≥ 3 จุด (แนะนำ ≥ 4) — ไม่ส่ง = ใช้ assumedSpacingM */
  controlPoints?: ControlPointDto[];
  /** ระยะปลูกที่ผู้ใช้ระบุ (เมตร) — ผลเป็นค่าประมาณ (MOCK-001) */
  assumedSpacingM?: number;
  /** ชื่อผลการนับ (บันทึกเท่านั้น) */
  name?: string;
  /** ผลที่ผู้ใช้ตรวจ/แก้แล้วจากขั้นวิเคราะห์ — ส่งมา = ไม่ตรวจจับใหม่ ใช้จุดนี้เลย (บันทึกเท่านั้น) */
  result?: TreeSurveyResultInput;
}

export interface TreeSurveyResultInput {
  points: PixelPoint[];
  grid?: Partial<GridParamsDto> | null;
  detectionMethod: 'blob' | 'blob+local-min';
  /** ผู้ใช้แก้จุด/กริดก่อนบันทึก */
  edited: boolean;
}

/** ผลวิเคราะห์ภาพที่ยังไม่บันทึก (POST …/tree-surveys/analyze) */
export interface TreeSurveyAnalysisDto {
  imageWidth: number;
  imageHeight: number;
  stats: TreeSurveyStatsDto;
  gridLines: GridLineDto[];
  trees: SurveyedTreeDto[];
}

/** พรีวิวการแก้ผลที่ยังไม่บันทึก (POST …/tree-surveys/preview) — ส่งบริบทของภาพมาเอง */
export interface TreeSurveyDraftPreviewRequest {
  imageWidth: number;
  imageHeight: number;
  boundaryPx: PixelPoint[];
  controlPoints?: ControlPointDto[];
  assumedSpacingM?: number;
  detectionMethod: 'blob' | 'blob+local-min';
  points: PixelPoint[];
  grid?: Partial<GridParamsDto> | null;
  fillGaps?: boolean;
}

export type TreeSurveyScaleSource = 'georef' | 'assumedSpacing' | 'none';

/** ค่ากริด: มุมแนวแถว (องศา) + ระยะช่อง (พิกเซล) + จุดตัดอ้างอิงบนภาพ */
export interface GridParamsDto {
  angleDeg: number;
  spacingPx: number;
  originX: number;
  originY: number;
}

export interface SurveyedTreeDto {
  treeId: string;
  orderNum: number;
  row: number;
  column: number;
  pixel: PixelPoint;
  lngLat: LngLat | null;
  nearestTreeId: string;
  nearestDistancePx: number;
  nearestDistanceM: number | null;
}

export interface GridLineDto {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: 'v' | 'h';
}

export interface TreeSurveyStatsDto {
  treeCount: number;
  rowCount: number;
  medianSpacingPx: number;
  meanNearestDistanceM: number | null;
  metersPerPixel: number | null;
  scaleSource: TreeSurveyScaleSource;
  /** true = ระยะเป็นค่าประมาณ → หน้าจอต้องติดป้าย "ประมาณ" */
  scaleIsEstimate: boolean;
  georef: { epsg: number; rmsErrorM: number } | null;
  gridAngleDeg: number;
  detectionMethod: 'blob' | 'blob+local-min';
  /** ค่ากริดที่ใช้ — null = ผลก่อน contracts 0.2.0 (ส่ง grid ว่างตอนแก้ไขเพื่อให้คำนวณอัตโนมัติ) */
  grid: GridParamsDto | null;
  /** true = ผู้ใช้แก้จุด/กริดเองแล้ว */
  edited: boolean;
}

export interface TreeSurveySummaryDto {
  id: string;
  parcelId: string;
  /** null = ผลก่อน contracts 0.5.0 (ไม่มีชื่อ) */
  name: string | null;
  treeCount: number;
  scaleSource: TreeSurveyScaleSource;
  scaleIsEstimate: boolean;
  /** ISO-8601 UTC */
  createdAt: string;
  /** ISO-8601 UTC — แก้ไขล่าสุด · null = ยังไม่เคยแก้ */
  updatedAt: string | null;
}

export interface TreeSurveyDto extends TreeSurveySummaryDto {
  imageWidth: number;
  imageHeight: number;
  /** signed download URL อายุสั้น — ห้ามเก็บ */
  imageUrl: string;
  boundaryPx: PixelPoint[];
  controlPoints: ControlPointDto[] | null;
  stats: TreeSurveyStatsDto;
  gridLines: GridLineDto[];
  trees: SurveyedTreeDto[];
}

// ── แก้ไขผล (editor) ────────────────────────────────────────────────────────

/** จุดต้นไม้ทั้งหมดหลังแก้ + ค่ากริด (ไม่ส่ง/ส่งบางฟิลด์ = คำนวณอัตโนมัติ) */
export interface TreeSurveyEditRequest {
  points: PixelPoint[];
  grid?: Partial<GridParamsDto> | null;
  /** เปลี่ยนชื่อ (ไม่ส่ง = คงเดิม) */
  name?: string;
}

export interface TreeSurveyPreviewRequest extends TreeSurveyEditRequest {
  /** เติมจุดที่จุดตัดกริดซึ่งอยู่ในขอบเขตและยังไม่มีต้นไม้ */
  fillGaps?: boolean;
}

/** ผลคำนวณใหม่โดยยังไม่บันทึก */
export interface TreeSurveyPreviewDto {
  stats: TreeSurveyStatsDto;
  gridLines: GridLineDto[];
  trees: SurveyedTreeDto[];
  /** จำนวนจุดที่เติมจาก fillGaps */
  addedCount: number;
}
