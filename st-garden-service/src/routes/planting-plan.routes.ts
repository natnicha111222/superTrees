// /api/v1/gardens/{parcelId}/planting-plans — validate DTO แล้วเรียก service เท่านั้น
import { Hono } from 'hono';
import { z } from 'zod';
import {
  PLANTING_PLAN_MAX_BOUNDARY_POINTS,
  PLANTING_PLAN_MAX_TREES,
  type PlantingPlanCreateRequest,
  type PlantingPlanPreviewRequest,
  type PlantingPlanUpdateRequest,
} from '@supertrees/contracts';
import type { Config } from '../config';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import type { PlantingPlanService } from '../services/planting-plan.service';

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const params = z.object({ parcelId: z.uuid() });
const planParams = params.extend({ planId: z.uuid() });

// request body ใช้ strictObject — ฟิลด์เกินถูกปฏิเสธ (CODE_STANDARDS 4)
const previewBody = z.strictObject({
  boundary: z.array(lngLat).min(3).max(PLANTING_PLAN_MAX_BOUNDARY_POINTS),
  spacingM: z.number().min(0.5).max(100),
  angleDeg: z.number().min(-360).max(360).optional(),
  offsetM: z.tuple([z.number().min(-1000).max(1000), z.number().min(-1000).max(1000)]).optional(),
  removed: z.array(lngLat).max(PLANTING_PLAN_MAX_TREES).optional(),
  extras: z.array(lngLat).max(PLANTING_PLAN_MAX_TREES).optional(),
}) satisfies z.ZodType<PlantingPlanPreviewRequest>;
const createBody = previewBody.extend({
  name: z.string().trim().min(1).max(100),
}) satisfies z.ZodType<PlantingPlanCreateRequest>;
const updateBody = createBody satisfies z.ZodType<PlantingPlanUpdateRequest>;

const compareQuery = z.object({
  surveyId: z.uuid(),
  toleranceM: z.coerce.number().positive().max(100).optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export function plantingPlanRoutes(config: Config, plans: PlantingPlanService) {
  return new Hono<AuthEnv>()
    .use('*', requireAuth(config))
    .post('/preview', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      return c.json(await plans.preview(c.get('user'), parcelId, previewBody.parse(await c.req.json())));
    })
    .post('/', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      return c.json(await plans.create(c.get('user'), parcelId, createBody.parse(await c.req.json())), 201);
    })
    .get('/', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      const { page, size } = listQuery.parse(c.req.query());
      return c.json(await plans.list(c.get('user'), parcelId, page, size));
    })
    .get('/:planId', async (c) => {
      const { parcelId, planId } = planParams.parse(c.req.param());
      return c.json(await plans.get(c.get('user'), parcelId, planId));
    })
    // เทียบแผนกับผลนับต้นไม้จากภาพที่ผูกแผนที่แล้ว (คำนวณสด)
    .get('/:planId/compare', async (c) => {
      const { parcelId, planId } = planParams.parse(c.req.param());
      const { surveyId, toleranceM } = compareQuery.parse(c.req.query());
      return c.json(await plans.compare(c.get('user'), parcelId, planId, surveyId, toleranceM));
    })
    // บันทึกการแก้ไข (หมุด/กริด/ระยะ/ชื่อ) — แทนที่ทั้งหมด
    .put('/:planId', async (c) => {
      const { parcelId, planId } = planParams.parse(c.req.param());
      return c.json(await plans.update(c.get('user'), parcelId, planId, updateBody.parse(await c.req.json())));
    });
}
