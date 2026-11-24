// วางแผนปลูก — ตรวจรูปแปลง, คำนวณตำแหน่งต้นไม้, บันทึก/แก้ไข, publish
import {
  ROUTING_KEYS,
  type GardenPlantingPlanCreatedData,
  type GardenPlantingPlanUpdatedData,
  type Page,
  type PlanComparisonDto,
  type PlantingPlanCreateRequest,
  type PlantingPlanDto,
  type PlantingPlanLayoutDto,
  type PlantingPlanPreviewRequest,
  type PlantingPlanSummaryDto,
  type PlantingPlanUpdateRequest,
} from '@supertrees/contracts';
import { AppError, notFound } from '../errors';
import type { EventPublisher } from '../events/publisher';
import type { AuthUser } from '../middleware/auth';
import type { NewPlantingPlan, PlantingPlanRepository, PlantingPlanRow } from '../repositories/planting-plan.repository';
import type { TreeSurveyRepository } from '../repositories/tree-survey.repository';
import { comparePlanToSurvey } from './planting/compare';
import { planPlantingLayout, PlantingError, type PlantingLayout } from './planting/layout';

export interface PlantingPlanDeps {
  repo: PlantingPlanRepository;
  /** อ่านผลนับต้นไม้เพื่อเทียบกับแผน (schema garden ของ service เดียวกัน) */
  surveys: Pick<TreeSurveyRepository, 'findById' | 'findTrees'>;
  events: EventPublisher;
}

export function createPlantingPlanService({ repo, surveys, events }: PlantingPlanDeps) {
  // MOCK-003: ยังไม่ถาม parcel-service ว่าแปลงมีจริง/เป็นของผู้ใช้ — ข้อมูลกรองด้วย owner_id อยู่แล้ว
  async function assertParcelAccess(_user: AuthUser, _parcelId: string): Promise<void> {}

  /** ไม่บอกว่ามีอยู่แต่ไม่ใช่ของเรา (กันเดา id) */
  function assertOwned(row: PlantingPlanRow | undefined, user: AuthUser, parcelId: string): asserts row is PlantingPlanRow {
    if (!row || row.ownerId !== user.id || row.parcelId !== parcelId) throw notFound('แผนปลูก');
  }

  /** ตรวจรูปแปลงด้วย PostGIS (ST_IsValid — CLAUDE.md) แล้วคำนวณตำแหน่งต้นไม้ */
  async function layout(req: PlantingPlanPreviewRequest): Promise<PlantingLayout> {
    const reason = await repo.polygonInvalidReason(req.boundary);
    if (reason) {
      throw new AppError(422, 'BOUNDARY_INVALID', 'รูปแปลงไม่ถูกต้อง — ขอบแปลงตัดกันเอง ลองปักมุมตามลำดับรอบแปลง', { reason });
    }
    try {
      return planPlantingLayout(req);
    } catch (e) {
      if (e instanceof PlantingError) throw new AppError(422, e.code, e.message);
      throw e;
    }
  }

  /** คอลัมน์ของ planting_plans จากคำขอ + ผลคำนวณ */
  function planColumns(req: PlantingPlanCreateRequest, l: PlantingLayout): Omit<NewPlantingPlan, 'parcelId' | 'ownerId'> {
    return {
      name: req.name.trim(),
      boundary: req.boundary,
      spacingM: String(req.spacingM),
      angleDeg: String(l.angleDeg),
      offsetXM: String(l.offsetM[0]),
      offsetYM: String(l.offsetM[1]),
      removed: req.removed ?? [],
      extras: req.extras ?? [],
      utmEpsg: l.utmEpsg,
      areaSqm: String(l.areaSqm),
      treeCount: l.trees.length,
      rowCount: l.rowCount,
    };
  }

  const treeRows = (l: PlantingLayout) =>
    l.trees.map((t) => ({ treeNo: t.orderNum, rowNo: t.row, colNo: t.column, manual: t.manual, lngLat: t.lngLat }));

  return {
    async preview(user: AuthUser, parcelId: string, req: PlantingPlanPreviewRequest): Promise<PlantingPlanLayoutDto> {
      await assertParcelAccess(user, parcelId);
      return layoutDto(await layout(req));
    },

    async create(user: AuthUser, parcelId: string, req: PlantingPlanCreateRequest): Promise<PlantingPlanDto> {
      await assertParcelAccess(user, parcelId);
      const l = await layout(req);
      const plan = await repo.transaction(async (tx) => {
        const row = await repo.insertPlan(tx, { parcelId, ownerId: user.id, ...planColumns(req, l) });
        await repo.insertTrees(tx, row.id, treeRows(l));
        return row;
      });
      // publish หลัง commit เท่านั้น
      await events.publish<GardenPlantingPlanCreatedData>(ROUTING_KEYS.gardenPlantingPlanCreated, {
        planId: plan.id,
        parcelId,
        treeCount: plan.treeCount,
      });
      return planDto(plan, l);
    },

    /** บันทึกการแก้ไข (หมุด/กริด/ระยะ/ชื่อ) — แทนที่ต้นไม้ทั้งหมดใน transaction เดียว */
    async update(user: AuthUser, parcelId: string, planId: string, req: PlantingPlanUpdateRequest): Promise<PlantingPlanDto> {
      // ตรวจ/คำนวณก่อนล็อกแถว (ตรวจรูปแปลงเรียก DB) — ใน transaction ตรวจเจ้าของซ้ำด้วย FOR UPDATE
      assertOwned(await repo.findById(planId), user, parcelId);
      const l = await layout(req);
      const plan = await repo.transaction(async (tx) => {
        const row = await repo.findByIdForUpdate(tx, planId);
        assertOwned(row, user, parcelId);
        const updated = await repo.updatePlan(tx, row.id, { ...planColumns(req, l), updatedAt: new Date() });
        await repo.deleteTrees(tx, row.id);
        await repo.insertTrees(tx, row.id, treeRows(l));
        return updated;
      });
      await events.publish<GardenPlantingPlanUpdatedData>(ROUTING_KEYS.gardenPlantingPlanUpdated, {
        planId: plan.id,
        parcelId,
        treeCount: plan.treeCount,
      });
      return planDto(plan, l);
    },

    /**
     * เทียบแผนกับผลนับต้นไม้จากภาพ (ต้องผูกแผนที่แล้ว) — จับคู่หลุม↔ต้นที่ห่างไม่เกิน toleranceM (ค่าเริ่มต้นครึ่งระยะปลูก)
     * คำนวณสด ไม่บันทึก
     */
    async compare(user: AuthUser, parcelId: string, planId: string, surveyId: string, toleranceM?: number): Promise<PlanComparisonDto> {
      const plan = await repo.findById(planId);
      assertOwned(plan, user, parcelId);
      const survey = await surveys.findById(surveyId);
      if (!survey || survey.ownerId !== user.id || survey.parcelId !== parcelId) throw notFound('ผลการนับต้นไม้');
      const spacing = Number(plan.spacingM);
      const tol = toleranceM ?? spacing / 2;
      if (!(tol > 0 && tol <= spacing)) {
        throw new AppError(400, 'TOLERANCE_INVALID', `ระยะจับคู่ต้องมากกว่า 0 และไม่เกินระยะปลูก (${spacing} ม.)`);
      }
      const [planTrees, surveyTrees] = await Promise.all([repo.findTrees(plan.id), surveys.findTrees(survey.id)]);
      if (surveyTrees.some((t) => !t.lngLat)) {
        throw new AppError(422, 'SURVEY_NOT_GEOREFERENCED', 'ผลนับนี้ไม่ได้ผูกแผนที่ (ไม่ได้ปักจุดอ้างอิง) จึงเทียบกับแผนไม่ได้');
      }
      const r = comparePlanToSurvey(
        { boundary: plan.boundary, slots: planTrees.map((t) => ({ id: treeId(t.treeNo), row: t.rowNo, column: t.colNo, lngLat: t.lngLat })) },
        surveyTrees.map((t) => ({ id: `T_${String(t.treeNo).padStart(3, '0')}`, lngLat: t.lngLat! })),
        tol,
      );
      return {
        planId: plan.id,
        surveyId: survey.id,
        toleranceM: tol,
        stats: r.stats,
        matched: r.matched.map((m) => ({ ...m, planLngLat: [...m.planLngLat] as [number, number], surveyLngLat: [...m.surveyLngLat] as [number, number] })),
        missing: r.missing.map((m) => ({ planTreeId: m.id, row: m.row, column: m.column, lngLat: [...m.lngLat] as [number, number] })),
        extra: r.extra.map((e) => ({ surveyTreeId: e.surveyTreeId, lngLat: [...e.lngLat] as [number, number], insidePlan: e.insidePlan })),
      };
    },

    async list(user: AuthUser, parcelId: string, page: number, size: number): Promise<Page<PlantingPlanSummaryDto>> {
      await assertParcelAccess(user, parcelId);
      const { items, totalItems } = await repo.listByOwnerAndParcel(user.id, parcelId, page, size);
      return { items: items.map(toSummary), page, size, totalItems };
    },

    async get(user: AuthUser, parcelId: string, planId: string): Promise<PlantingPlanDto> {
      const row = await repo.findById(planId);
      assertOwned(row, user, parcelId);
      // เส้นกริดไม่ได้เก็บ — คำนวณจากค่าที่บันทึกไว้ (ผลเดียวกับตอนบันทึก)
      const l = planPlantingLayout({
        boundary: row.boundary,
        spacingM: Number(row.spacingM),
        angleDeg: Number(row.angleDeg),
        offsetM: [Number(row.offsetXM), Number(row.offsetYM)],
        removed: row.removed,
        extras: row.extras,
      });
      const trees = await repo.findTrees(row.id);
      return {
        ...planDto(row, l),
        trees: trees.map((t) => ({ treeId: treeId(t.treeNo), orderNum: t.treeNo, row: t.rowNo, column: t.colNo, lngLat: t.lngLat, manual: t.manual })),
        treeCount: row.treeCount,
        rowCount: row.rowCount,
      };
    },
  };
}
export type PlantingPlanService = ReturnType<typeof createPlantingPlanService>;

function layoutDto(l: PlantingLayout): PlantingPlanLayoutDto {
  return {
    spacingM: l.spacingM,
    angleDeg: l.angleDeg,
    offsetM: l.offsetM,
    utmEpsg: l.utmEpsg,
    areaSqm: l.areaSqm,
    treeCount: l.trees.length,
    rowCount: l.rowCount,
    trees: l.trees.map((t) => ({ treeId: t.treeId, orderNum: t.orderNum, row: t.row, column: t.column, lngLat: t.lngLat, manual: t.manual })),
    gridLines: l.gridLines,
  };
}

function planDto(row: PlantingPlanRow, l: PlantingLayout): PlantingPlanDto {
  return { ...toSummary(row), ...layoutDto(l), boundary: row.boundary, removed: row.removed, extras: row.extras };
}

function toSummary(row: PlantingPlanRow): PlantingPlanSummaryDto {
  return {
    id: row.id,
    parcelId: row.parcelId,
    name: row.name,
    spacingM: Number(row.spacingM),
    treeCount: row.treeCount,
    areaSqm: Number(row.areaSqm),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function treeId(n: number): string {
  return `TREE_${String(n).padStart(3, '0')}`;
}
