// schema `garden` — เจ้าของคือ st-garden-service เท่านั้น (ห้าม service อื่น query)
// เปลี่ยนแล้วต้อง `bun run db:generate` ได้ไฟล์ migration ใหม่เสมอ
import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ControlPointDto, GridLineDto, LngLat, PixelPoint, TreeSurveyStatsDto } from '@supertrees/contracts';

export const garden = pgSchema('garden');

/**
 * geometry(Point, 4326) — `geometry()` ของ drizzle ทิ้ง SRID ใน DDL จึงประกาศเอง
 * เขียนด้วย sql`ST_SetSRID(ST_MakePoint(lng, lat), 4326)` · อ่านด้วย ST_X/ST_Y (ดู repository)
 */
const pointGeom = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(Point, 4326)',
});

/** geometry(Polygon, 4326) — เขียนด้วย ST_GeomFromGeoJSON (ดู repository) · BUG-002 */
const polygonGeom = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(Polygon, 4326)',
});

/** TASK-010: ผลการนับต้นไม้จากภาพ 1 ครั้ง */
export const treeSurveys = garden
  .table(
    'tree_surveys',
    {
      id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
      /** id ของ parcel-service — ไม่มี FK ข้าม schema (MOCK-003: ยังไม่ตรวจว่าแปลงมีจริง/เป็นของผู้ใช้) */
      parcelId: uuid('parcel_id').notNull(),
      ownerId: uuid('owner_id').notNull(),
      /** ชื่อผลการนับ — null = ผลก่อนมีชื่อ (contracts < 0.5.0) */
      name: text('name'),
      /** object path ใน bucket garden-photos — ไม่ใช่ URL */
      imagePath: text('image_path').notNull(),
      imageWidth: integer('image_width').notNull(),
      imageHeight: integer('image_height').notNull(),
      boundaryPx: jsonb('boundary_px').$type<PixelPoint[]>().notNull(),
      controlPoints: jsonb('control_points').$type<ControlPointDto[]>(),
      scaleSource: text('scale_source').$type<TreeSurveyStatsDto['scaleSource']>().notNull(),
      scaleIsEstimate: boolean('scale_is_estimate').notNull(),
      metersPerPixel: numeric('meters_per_pixel', { precision: 12, scale: 6 }),
      /** ระยะปลูกที่ผู้ใช้ระบุ (scale_source = assumedSpacing) — ใช้คำนวณใหม่ตอนแก้กริด (MOCK-001) */
      assumedSpacingM: numeric('assumed_spacing_m', { precision: 8, scale: 3 }),
      georefRmsErrorM: numeric('georef_rms_error_m', { precision: 10, scale: 2 }),
      utmEpsg: integer('utm_epsg'),
      treeCount: integer('tree_count').notNull(),
      stats: jsonb('stats').$type<TreeSurveyStatsDto>().notNull(),
      gridLines: jsonb('grid_lines').$type<GridLineDto[]>().notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      /** แก้จุด/กริดล่าสุด — null = ยังไม่เคยแก้ */
      updatedAt: timestamp('updated_at', { withTimezone: true }),
    },
    (t) => [index('tree_surveys_owner_parcel_idx').on(t.ownerId, t.parcelId, t.createdAt)],
  )
  .enableRLS();

export const treeSurveyTrees = garden
  .table(
    'tree_survey_trees',
    {
      surveyId: uuid('survey_id')
        .notNull()
        .references(() => treeSurveys.id, { onDelete: 'cascade' }),
      treeNo: integer('tree_no').notNull(),
      rowNo: integer('row_no').notNull(),
      colNo: integer('col_no').notNull(),
      pixelX: integer('pixel_x').notNull(),
      pixelY: integer('pixel_y').notNull(),
      nearestTreeNo: integer('nearest_tree_no').notNull(),
      nearestDistancePx: real('nearest_distance_px').notNull(),
      nearestDistanceM: real('nearest_distance_m'),
      /** null จนกว่าจะผูกภาพกับแผนที่ (CONF-005) */
      geom: pointGeom('geom'),
    },
    (t) => [primaryKey({ columns: [t.surveyId, t.treeNo] }), index('tree_survey_trees_geom_gist').using('gist', t.geom)],
  )
  .enableRLS();

/** แผนปลูก: ขอบเขตที่ผู้ใช้ปักบนแผนที่ + ระยะปลูก → ตำแหน่งต้นไม้ตามแนวขอบแปลง */
export const plantingPlans = garden
  .table(
    'planting_plans',
    {
      id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
      /** id ของ parcel-service — ไม่มี FK ข้าม schema (MOCK-003) */
      parcelId: uuid('parcel_id').notNull(),
      ownerId: uuid('owner_id').notNull(),
      name: text('name').notNull(),
      /** มุมแปลงตามลำดับที่ปัก [lng, lat] (ลำดับกำหนดแนวแถว) */
      boundary: jsonb('boundary').$type<LngLat[]>().notNull(),
      /** ขอบเขตเดียวกันเป็น geometry สำหรับค้นเชิงพื้นที่ */
      geom: polygonGeom('geom').notNull(),
      spacingM: numeric('spacing_m', { precision: 8, scale: 3 }).notNull(),
      angleDeg: numeric('angle_deg', { precision: 9, scale: 4 }).notNull(),
      /** เลื่อนกริด (เมตร) ตามแนวแถว / ตั้งฉาก */
      offsetXM: numeric('offset_x_m', { precision: 9, scale: 3 }).notNull().default('0'),
      offsetYM: numeric('offset_y_m', { precision: 9, scale: 3 }).notNull().default('0'),
      /** ตำแหน่งหมุดตามกริดที่ผู้ใช้ลบ / หมุดที่เพิ่มเอง [lng, lat] — เก็บไว้แก้ต่อ */
      removed: jsonb('removed').$type<LngLat[]>().notNull().default([]),
      extras: jsonb('extras').$type<LngLat[]>().notNull().default([]),
      utmEpsg: integer('utm_epsg').notNull(),
      areaSqm: numeric('area_sqm', { precision: 14, scale: 2 }).notNull(),
      treeCount: integer('tree_count').notNull(),
      rowCount: integer('row_count').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }),
    },
    (t) => [index('planting_plans_owner_parcel_idx').on(t.ownerId, t.parcelId, t.createdAt), index('planting_plans_geom_gist').using('gist', t.geom)],
  )
  .enableRLS();

export const plantingPlanTrees = garden
  .table(
    'planting_plan_trees',
    {
      planId: uuid('plan_id')
        .notNull()
        .references(() => plantingPlans.id, { onDelete: 'cascade' }),
      treeNo: integer('tree_no').notNull(),
      rowNo: integer('row_no').notNull(),
      colNo: integer('col_no').notNull(),
      /** true = ผู้ใช้เพิ่มเอง */
      manual: boolean('manual').notNull().default(false),
      geom: pointGeom('geom').notNull(),
    },
    (t) => [primaryKey({ columns: [t.planId, t.treeNo] }), index('planting_plan_trees_geom_gist').using('gist', t.geom)],
  )
  .enableRLS();
