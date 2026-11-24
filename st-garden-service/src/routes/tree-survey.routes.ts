// TASK-010 — /api/v1/gardens/{parcelId}/tree-surveys · validate DTO แล้วเรียก service เท่านั้น
import { Hono } from 'hono';
import { z } from 'zod';
import {
  TREE_SURVEY_IMAGE_TYPES,
  TREE_SURVEY_MAX_FILE_BYTES,
  TREE_SURVEY_MAX_IMAGE_SIDE_PX,
  TREE_SURVEY_MAX_TREES,
  type TreeSurveyCreateRequest,
  type TreeSurveyDraftPreviewRequest,
  type TreeSurveyEditRequest,
  type TreeSurveyPreviewRequest,
  type TreeSurveyUploadUrlRequest,
} from '@supertrees/contracts';
import type { Config } from '../config';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import type { TreeSurveyService } from '../services/tree-survey.service';

const max = TREE_SURVEY_MAX_IMAGE_SIDE_PX;
const pixel = z.tuple([z.number().min(0).max(max), z.number().min(0).max(max)]);
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const params = z.object({ parcelId: z.uuid() });
const surveyParams = params.extend({ surveyId: z.uuid() });

// request body ใช้ strictObject — ฟิลด์เกินถูกปฏิเสธ (CODE_STANDARDS 4)
const uploadUrlBody = z.strictObject({
  contentType: z.enum(TREE_SURVEY_IMAGE_TYPES),
  sizeBytes: z.number().int().positive().max(TREE_SURVEY_MAX_FILE_BYTES),
}) satisfies z.ZodType<TreeSurveyUploadUrlRequest>;

// แก้ไขผล: จุดทั้งหมด + ค่ากริด (บางฟิลด์/ไม่ส่ง = อัตโนมัติ)
const gridParams = z
  .strictObject({
    angleDeg: z.number().min(-90).max(90),
    spacingPx: z.number().positive().max(max),
    originX: z.number().min(-max).max(2 * max),
    originY: z.number().min(-max).max(2 * max),
  })
  .partial();
const detectionMethod = z.enum(['blob', 'blob+local-min']);
const points = z.array(pixel).max(TREE_SURVEY_MAX_TREES);
const name = z.string().trim().min(1).max(100);

/** มาตราส่วน: จุดคู่ หรือ ระยะปลูก อย่างใดอย่างหนึ่ง */
const oneScale = <T extends { controlPoints?: unknown; assumedSpacingM?: unknown }>(b: T) => !(b.controlPoints && b.assumedSpacingM);
const oneScaleMsg = { message: 'ส่ง controlPoints หรือ assumedSpacingM อย่างใดอย่างหนึ่ง', path: ['assumedSpacingM'] };

const imageContext = {
  boundaryPx: z.array(pixel).min(3).max(200),
  controlPoints: z.array(z.strictObject({ pixel, lngLat })).min(3).max(50).optional(),
  assumedSpacingM: z.number().positive().max(100).optional(),
};
const analyzeShape = {
  objectPath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png)$/, 'objectPath ไม่ถูกรูปแบบ'),
  ...imageContext,
};
// วิเคราะห์ (ไม่บันทึก)
const analyzeBody = z.strictObject(analyzeShape).refine(oneScale, oneScaleMsg) satisfies z.ZodType<TreeSurveyCreateRequest>;
// บันทึก — result = ผลที่ผู้ใช้ตรวจ/แก้แล้วจากขั้นวิเคราะห์
const createBody = z
  .strictObject({
    ...analyzeShape,
    name: name.optional(),
    result: z
      .strictObject({ points, grid: gridParams.nullable().optional(), detectionMethod, edited: z.boolean() })
      .optional(),
  })
  .refine(oneScale, oneScaleMsg) satisfies z.ZodType<TreeSurveyCreateRequest>;
// พรีวิวฉบับร่าง (ยังไม่บันทึก) — ส่งบริบทของภาพมาเอง
const draftPreviewBody = z
  .strictObject({
    ...imageContext,
    imageWidth: z.number().int().positive().max(max),
    imageHeight: z.number().int().positive().max(max),
    detectionMethod,
    points,
    grid: gridParams.nullable().optional(),
    fillGaps: z.boolean().optional(),
  })
  .refine(oneScale, oneScaleMsg) satisfies z.ZodType<TreeSurveyDraftPreviewRequest>;

const editBody = z.strictObject({
  points,
  grid: gridParams.nullable().optional(),
  name: name.optional(),
}) satisfies z.ZodType<TreeSurveyEditRequest>;
const previewBody = z.strictObject({
  points,
  grid: gridParams.nullable().optional(),
  fillGaps: z.boolean().optional(),
}) satisfies z.ZodType<TreeSurveyPreviewRequest>;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export function treeSurveyRoutes(config: Config, surveys: TreeSurveyService) {
  return new Hono<AuthEnv>()
    .use('*', requireAuth(config))
    .post('/upload-url', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      const body = uploadUrlBody.parse(await c.req.json());
      return c.json(await surveys.createUploadUrl(c.get('user'), parcelId, body), 201);
    })
    // วิเคราะห์ภาพ — ยังไม่บันทึก (ผู้ใช้ตรวจ/แก้ แล้วค่อย POST / พร้อม result)
    .post('/analyze', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      return c.json(await surveys.analyze(c.get('user'), parcelId, analyzeBody.parse(await c.req.json())));
    })
    // พรีวิวการแก้ผลที่ยังไม่บันทึก
    .post('/preview', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      return c.json(await surveys.previewDraft(c.get('user'), parcelId, draftPreviewBody.parse(await c.req.json())));
    })
    .post('/', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      const body = createBody.parse(await c.req.json());
      return c.json(await surveys.create(c.get('user'), parcelId, body), 201);
    })
    .get('/', async (c) => {
      const { parcelId } = params.parse(c.req.param());
      const { page, size } = listQuery.parse(c.req.query());
      return c.json(await surveys.list(c.get('user'), parcelId, page, size));
    })
    .get('/:surveyId', async (c) => {
      const { parcelId, surveyId } = surveyParams.parse(c.req.param());
      return c.json(await surveys.get(c.get('user'), parcelId, surveyId));
    })
    // คำนวณผลจากจุด/กริดที่แก้ โดยยังไม่บันทึก (editor เรียกทุกครั้งที่แก้)
    .post('/:surveyId/preview', async (c) => {
      const { parcelId, surveyId } = surveyParams.parse(c.req.param());
      const body = previewBody.parse(await c.req.json());
      return c.json(await surveys.preview(c.get('user'), parcelId, surveyId, body));
    })
    // บันทึกจุด/กริดที่แก้ (แทนที่ต้นไม้ทั้งหมดของผลนี้)
    .put('/:surveyId', async (c) => {
      const { parcelId, surveyId } = surveyParams.parse(c.req.param());
      const body = editBody.parse(await c.req.json());
      return c.json(await surveys.update(c.get('user'), parcelId, surveyId, body));
    });
}
