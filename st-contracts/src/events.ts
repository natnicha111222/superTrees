// ทะเบียน event อยู่ที่ EVENTS.md ของ workspace — เพิ่ม routing key ที่นี่พร้อมกันเสมอ

export const EVENTS_EXCHANGE = 'supertrees.events';

export interface EventEnvelope<T = unknown> {
  /** uuid v7 — consumer ใช้กันประมวลผลซ้ำ */
  eventId: string;
  type: string;
  version: number;
  /** ISO-8601 UTC */
  occurredAt: string;
  producer: string;
  data: T;
}

export const ROUTING_KEYS = {
  /** TASK-002: service เริ่มทำงาน — ใช้ทดสอบเส้นทาง publish/consume */
  systemServiceStarted: 'system.service.started',
  /** TASK-010 */
  gardenTreeSurveyCompleted: 'garden.tree-survey.completed',
  /** TASK-010: ผู้ใช้แก้จุด/กริดแล้วบันทึก */
  gardenTreeSurveyUpdated: 'garden.tree-survey.updated',
  /** บันทึกแผนปลูกใหม่ */
  gardenPlantingPlanCreated: 'garden.planting-plan.created',
  /** แก้ไขแผนปลูก (หมุด/กริด/ระยะ) แล้วบันทึก */
  gardenPlantingPlanUpdated: 'garden.planting-plan.updated',
} as const;

export interface SystemServiceStartedData {
  service: string;
}

export interface GardenTreeSurveyCompletedData {
  surveyId: string;
  parcelId: string;
  treeCount: number;
}

export interface GardenTreeSurveyUpdatedData {
  surveyId: string;
  parcelId: string;
  treeCount: number;
}

export type GardenPlantingPlanUpdatedData = GardenPlantingPlanCreatedData;

export interface GardenPlantingPlanCreatedData {
  planId: string;
  parcelId: string;
  treeCount: number;
}
