// วางแผนปลูก — ปักขอบเขตแปลงบนแผนที่ + ระยะปลูก → ตำแหน่งต้นไม้ [lng, lat] ตามแนวขอบแปลง
import type { LngLat } from '../common.js';

export const PLANTING_PLAN_MAX_TREES = 20_000;
export const PLANTING_PLAN_MAX_BOUNDARY_POINTS = 200;

export interface PlantingPlanPreviewRequest {
  /** มุมแปลง [lng, lat] ≥ 3 จุด ตามลำดับที่ปัก (ไม่ต้องปิดวง) — ขอบแรก (จุด 1→2) กำหนดแนวแถว */
  boundary: LngLat[];
  /** ระยะปลูก (เมตร) */
  spacingM: number;
  /** มุมแนวแถว (องศา จากทิศตะวันออก ทวนเข็ม) · ไม่ส่ง = ขนานขอบแรก */
  angleDeg?: number;
  /** เลื่อนกริด [ตามแนวแถว, ตั้งฉาก (+ = ขึ้น)] เมตร */
  offsetM?: [number, number];
  /** ตำแหน่งหมุดตามกริดที่ผู้ใช้ลบ (จับคู่กับจุดตัดที่ใกล้กว่า 0.45 ระยะปลูก) */
  removed?: LngLat[];
  /** หมุดที่ผู้ใช้เพิ่มเอง (ไม่ขยับตามกริด) */
  extras?: LngLat[];
}

export interface PlantingPlanCreateRequest extends PlantingPlanPreviewRequest {
  name: string;
}

/** บันทึกการแก้ไขแผน (แทนที่ทั้งหมด) */
export type PlantingPlanUpdateRequest = PlantingPlanCreateRequest;

export interface PlannedTreeDto {
  treeId: string;
  orderNum: number;
  row: number;
  column: number;
  lngLat: LngLat;
  /** true = ผู้ใช้เพิ่มเอง */
  manual: boolean;
}

export interface PlantingPlanLayoutDto {
  spacingM: number;
  angleDeg: number;
  offsetM: [number, number];
  utmEpsg: number;
  /** พื้นที่แปลง (ตร.ม.) — แสดงเป็นไร่-งาน-ตร.วาด้วย pipe กลาง */
  areaSqm: number;
  treeCount: number;
  rowCount: number;
  trees: PlannedTreeDto[];
  /** เส้นกริดครอบแปลง */
  gridLines: [LngLat, LngLat][];
}

export interface PlantingPlanSummaryDto {
  id: string;
  parcelId: string;
  name: string;
  spacingM: number;
  treeCount: number;
  areaSqm: number;
  /** ISO-8601 UTC */
  createdAt: string;
  /** ISO-8601 UTC · null = ยังไม่เคยแก้ */
  updatedAt: string | null;
}

export interface PlantingPlanDto extends PlantingPlanSummaryDto, PlantingPlanLayoutDto {
  boundary: LngLat[];
  /** สถานะการแก้ไข — ส่งกลับมาใน PUT เพื่อแก้ต่อ */
  removed: LngLat[];
  extras: LngLat[];
}

// ── เทียบแผนปลูกกับผลนับต้นไม้จากภาพ (ที่ผูกแผนที่แล้ว) ───────────────────────

export interface PlanComparisonStatsDto {
  /** หลุมตามแผน */
  planned: number;
  /** ต้นที่ตรวจพบในผลนับ */
  detected: number;
  /** หลุมที่มีต้นไม้ (จับคู่ได้) */
  matched: number;
  /** หลุมที่ยังว่าง */
  missing: number;
  /** ต้นที่ไม่ตรงหลุมใดในแผน */
  extra: number;
  /** matched / planned (0–1) */
  matchRate: number;
  /** ระยะคลาดจากหลุมเฉลี่ย/มากสุด (เมตร) */
  meanOffsetM: number | null;
  maxOffsetM: number | null;
}

export interface PlanComparisonDto {
  planId: string;
  surveyId: string;
  /** ระยะสูงสุดที่ถือว่าต้นอยู่ในหลุมนั้น (เมตร) */
  toleranceM: number;
  stats: PlanComparisonStatsDto;
  matched: { planTreeId: string; surveyTreeId: string; planLngLat: LngLat; surveyLngLat: LngLat; offsetM: number }[];
  missing: { planTreeId: string; row: number; column: number; lngLat: LngLat }[];
  extra: { surveyTreeId: string; lngLat: LngLat; insidePlan: boolean }[];
}
