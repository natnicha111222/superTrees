# st-garden-service

ต้นไม้/สวนบนแปลง: นับต้นไม้จากภาพ (TASK-010), วางแผนปลูก (TASK-011), (ภายหลัง) การปลูก, ชนิดพันธุ์ (master), ประเมินมูลค่า/คาร์บอน

> สถานะ: 🟡 TASK-002 (โครง) + TASK-010 (นับต้นไม้จากภาพ — API ครบ, เทสต์ด้วยของจำลองผ่าน) · ทดสอบ end-to-end กับ DB/Storage/RabbitMQ local ผ่าน (ภาพจำลอง)

- stack: Bun + Hono + Drizzle ORM + zod + sharp (decode ภาพ) · port (dev): 3003 · ฟังที่ `127.0.0.1`
- schema: `garden` (ห้าม query schema อื่น) · bucket: `garden-photos` (private, JPEG/PNG ≤ 20 MiB)

## Endpoints

| method | path | login | หมายเหตุ |
|---|---|---|---|
| GET | `/api/v1/gardens/health` | ไม่ต้อง | `checks.postgis` |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/upload-url` | ✅ | `{ contentType: image/jpeg\|image/png, sizeBytes ≤ 20 MiB }` → `{ objectPath, uploadUrl }` (signed upload URL — แอป PUT ไฟล์ตรงไป Storage) |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/analyze` | ✅ | `{ objectPath, boundaryPx, controlPoints? \| assumedSpacingM? }` → `TreeSurveyAnalysisDto` — **ไม่บันทึก** · sync, ภาพด้านยาว ≤ 4096 px (TASK-012) |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/preview` | ✅ | พรีวิวร่าง: บริบทภาพ (`imageWidth/Height`, `boundaryPx`, มาตราส่วน, `detectionMethod`) + `points`, `grid?`, `fillGaps?` → `TreeSurveyPreviewDto` |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys` | ✅ | บันทึก: + `name?`, `result?: { points, grid?, detectionMethod, edited }` → `TreeSurveyDto` (201) · มี `result` = ไม่ตรวจจับซ้ำ (อ่านแค่ขนาดภาพ) · ไม่มี = ตรวจจับแล้วบันทึก |
| GET | `/api/v1/gardens/{parcelId}/tree-surveys?page=&size=` | ✅ | `Page<TreeSurveySummaryDto>` ของผู้ใช้เอง |
| GET | `/api/v1/gardens/{parcelId}/tree-surveys/{surveyId}` | ✅ | `TreeSurveyDto` + `imageUrl` (signed download URL 10 นาที) · ไม่ใช่ของเรา = 404 |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/{surveyId}/preview` | ✅ | `{ points ≤ 20,000, grid?: Partial<GridParams> \| null, fillGaps? }` → `TreeSurveyPreviewDto` — คำนวณใหม่ ไม่บันทึก |
| PUT | `/api/v1/gardens/{parcelId}/tree-surveys/{surveyId}` | ✅ | `{ points, grid? }` → `TreeSurveyDto` — แทนที่ต้นไม้ทั้งหมดใน transaction (`SELECT … FOR UPDATE`) · publish `garden.tree-survey.updated` |

| POST | `/api/v1/gardens/{parcelId}/planting-plans/preview` | ✅ | `{ boundary: [lng,lat][] 3–200, spacingM 0.5–100, angleDeg? }` → `PlantingPlanLayoutDto` — ไม่บันทึก (TASK-011) |
| POST | `/api/v1/gardens/{parcelId}/planting-plans` | ✅ | + `name` → `PlantingPlanDto` (201) · publish `garden.planting-plan.created` |
| GET | `/api/v1/gardens/{parcelId}/planting-plans/{planId}/compare?surveyId=&toleranceM=` | ✅ | เทียบแผนกับผลนับที่ผูกแผนที่ → `PlanComparisonDto` · คำนวณสด · ไม่ผูกแผนที่ = 422 `SURVEY_NOT_GEOREFERENCED` · tolerance ≤ ระยะปลูก (ค่าเริ่มต้นครึ่ง) |
| GET | `/api/v1/gardens/{parcelId}/planting-plans?page=&size=` · `/{planId}` | ✅ | `Page<PlantingPlanSummaryDto>` / `PlantingPlanDto` (+ `gridLines` คำนวณจากค่าที่บันทึก, `removed`/`extras` สำหรับแก้ต่อ) · ไม่ใช่ของเรา = 404 |
| PUT | `/api/v1/gardens/{parcelId}/planting-plans/{planId}` | ✅ | บันทึกการแก้ไข `{ name, boundary, spacingM, angleDeg?, offsetM?, removed?, extras? }` → `PlantingPlanDto` · `FOR UPDATE` + แทนที่ต้นไม้ · publish `garden.planting-plan.updated` |

วางแผนปลูก: รูปแปลงตรวจด้วย `ST_IsValid` (ขอบตัดกัน → 422 `BOUNDARY_INVALID` + `details.reason`) · `TOO_MANY_TREES` 422 (> 20,000) · คำนวณใน `src/services/planting/layout.ts` (UTM, แนวแถวตามขอบแรก — ดู TASK-011) · แก้ไข: `offsetM` เลื่อนกริด (ม.), `removed` = ตำแหน่งหมุดตามกริดที่ลบ (จับคู่จุดตัดที่ใกล้กว่า 0.45 ระยะปลูก — เลื่อนกริดเล็กน้อยยังว่างอยู่), `extras` = หมุดที่เพิ่มเอง (ไม่ขยับตามกริด, `manual: true`) · แถว/คอลัมน์ = จุดตัดกริดที่ใกล้สุด

DTO อยู่ใน `@supertrees/contracts` (`garden/tree-survey.ts`, `garden/planting-plan.ts`) · error code: `VALIDATION_ERROR` 400, `AUTH_NOT_CONFIGURED` 503, `FORBIDDEN` 403 (objectPath ไม่ใช่ของผู้ใช้/แปลงนี้), `IMAGE_NOT_FOUND` 404, `IMAGE_INVALID`/`IMAGE_TOO_LARGE` 400 (ตรวจจากเนื้อไฟล์ด้วย sharp), `CONTROL_POINTS_*` 400, `TOO_FEW_TREES`/`BOUNDARY_*`/`GRID_INVALID` 422, `POINT_OUT_OF_IMAGE` 400 (แก้ไข), `NOT_FOUND` 404

การแก้ไข: จุด/กริดที่ผู้ใช้แก้ถูกคำนวณใหม่ด้วยโค้ดเดียวกับตอนนับ (แถว/ลำดับ/ระยะ/พิกัด) · มาตราส่วนใช้ข้อมูลตอนสร้าง (จุดคู่ → georef ใหม่, ระยะปลูก `assumed_spacing_m` → m/px = ระยะปลูก ÷ ระยะช่องตาราง) · ต้องมี ≥ 2 ต้น

ความปลอดภัย: object path = `<ownerId>/<parcelId>/<uuid>.<ext>` สร้างที่ service · owner_id มาจากผู้ใช้ที่ยืนยันแล้วเท่านั้น · list/get กรองด้วย owner_id · ⏳ ยังไม่ตรวจว่าแปลงเป็นของผู้ใช้ (MOCK-003 — รอ parcel-service)

## แกนกริดร่วม `src/services/grid/core.ts` (TASK-012)

ใช้ทั้งนับจากภาพ (พิกเซล) และวางแผนปลูก (เมตร บนระนาบ (E, −N)) — กติกาเดียว: แถว/คอลัมน์ = จุดตัดที่ใกล้สุด, เลข 1 = แถว/คอลัมน์แรกที่มีจุดตัดในแปลงจริง, เรียงแถวบน→ล่าง ซ้าย→ขวา, จุดตัดในแปลงไม่รวมบนเส้นขอบ, ใกล้กว่า 0.45 ช่อง = จุดเดียวกัน · **แก้กติกากริดที่ไฟล์นี้ที่เดียว**

`src/services/planting/compare.ts` — เทียบแผนกับผลนับบน UTM (จับคู่หนึ่งต่อหนึ่ง ใกล้สุดก่อน)

## โมดูล `src/services/tree-grid/` (TASK-010)

`analyzeTreeGrid(grayImage, boundaryPx, { scale })` → `{ trees[], gridLines[], stats, detection }`

- input: ภาพขาวดำ (`toGray()` จาก RGB/RGBA ที่ decode แล้ว) + ขอบเขตแปลงเป็นพิกัดพิกเซล ≥ 3 จุด
- `scale`: `{ kind: 'georef', georef: fitGeoref(controlPoints) }` (หลัก — CONF-005) · `{ kind: 'assumedSpacing' }` (สำรอง, MOCK-001, `scaleIsEstimate: true`) · `{ kind: 'metersPerPixel' }` · `{ kind: 'none' }`
- `fitGeoref([{ pixel: [x, y], lngLat: [lng, lat] }, …])` ≥ 3 จุด → affine พิกเซล→UTM (EPSG:326xx) · ผลมี `rmsErrorM` · error `GeorefError` (`CONTROL_POINTS_TOO_FEW` / `_COLLINEAR` / `_OUT_OF_RANGE`)
- error: `TreeGridError` code `IMAGE_TOO_LARGE` (ด้านยาว > `MAX_IMAGE_SIDE_PX` = 4096) / `BOUNDARY_TOO_FEW_POINTS` / `BOUNDARY_OUTSIDE_IMAGE` / `TOO_FEW_TREES`
- ไม่มี dependency · ผลลัพธ์มีพิกัดพิกเซลเสมอ + `lngLat` เมื่อผูกแผนที่
- กริด = `GridParams { angleDeg, spacingPx, originX, originY }` · `autoGridParams()` / `resolveGridParams(points, partial)` (ฟิลด์ที่ไม่ส่ง = อัตโนมัติ) · `buildTreeGrid(points, scale, { grid, extent })` — แถว/คอลัมน์ = จุดตัดกริดที่ใกล้สุด · `gridGapPoints()` = จุดตัดในขอบเขต (ไม่รวมบนเส้นขอบ) ที่ยังไม่มีต้นไม้ใกล้กว่า 0.45 ช่อง

## Schema / ตาราง (migration `drizzle/0000_init.sql` … `0004_tree_survey_name.sql`)
- `garden.tree_surveys`: `id`, `parcel_id uuid` (ไม่มี FK ข้าม schema), `owner_id`, `name text` (null = ผลก่อนมีชื่อ), `image_path` (object path ไม่ใช่ URL), `image_width/height`, `boundary_px jsonb`, `control_points jsonb` (null = ระยะปลูกสมมติ), `scale_source`, `scale_is_estimate`, `meters_per_pixel numeric`, `georef_rms_error_m numeric`, `utm_epsg`, `tree_count`, `stats jsonb`, `grid_lines jsonb`, `created_at timestamptz`, `assumed_spacing_m numeric` + `updated_at timestamptz` (migration `0001_tree_survey_edit` — เติม assumed_spacing_m ย้อนหลังให้ผลเดิม) · index (`owner_id`, `parcel_id`, `created_at`)
- `garden.tree_survey_trees`: PK (`survey_id`, `tree_no`) FK → tree_surveys (cascade), `row_no`, `col_no`, `pixel_x/y`, `nearest_tree_no`, `nearest_distance_px/m`, `geom geometry(Point, 4326)` null ได้ + GIST
- `garden.planting_plans`: `id`, `parcel_id`, `owner_id`, `name`, `boundary jsonb` (มุมตามลำดับที่ปัก), `geom geometry(Polygon, 4326)` + GIST, `spacing_m`, `angle_deg`, `offset_x_m`/`offset_y_m` (default 0), `removed`/`extras jsonb` (default `[]`), `utm_epsg`, `area_sqm numeric`, `tree_count`, `row_count`, `created_at`, `updated_at`
- `garden.planting_plan_trees`: PK (`plan_id`, `tree_no`) FK → planting_plans (cascade), `row_no`, `col_no`, `manual bool` (default false), `geom geometry(Point, 4326)` + GIST
- RLS เปิดทุกตาราง ไม่มี policy (เข้าถึงผ่าน service เท่านั้น)

## Event
- publish หลัง commit: `garden.tree-survey.completed` (สร้าง) · `garden.tree-survey.updated` (บันทึกการแก้ไข) · `garden.planting-plan.created` / `.updated` (`{ planId, parcelId, treeCount }`) — `{ surveyId, parcelId, treeCount }` · `system.service.started` ตอนเริ่ม

## env var (`.env.example`)
`APP_ENV` · `PORT` · `HOST` · `DATABASE_URL` (ค่าลับ) · `SUPABASE_URL` · `SUPABASE_PUBLIC_URL` (ถ้าเบราว์เซอร์ใช้ host อื่น) · `SUPABASE_SERVICE_ROLE_KEY` (ค่าลับ — server เท่านั้น) · `RABBITMQ_URL` (ค่าลับ) · `AUTH_MODE` · `DEV_USER_ID`

## รัน (dev)

```bash
cp .env.example .env      # แล้วกรอกค่า (ดู st-infra/README.md)
bun install
bun run db:migrate        # local เท่านั้น — ห้ามใช้กับ DB ที่ใช้ร่วมกัน
bun run dev               # หรือรันรวม: cd ../st-infra && npm run dev:backend
bun test · bun run typecheck
```

- โครง: `routes/` (zod + เรียก service) → `services/` (logic ทั้งหมด) → `repositories/` (Drizzle เท่านั้น) — PROJECT_STRUCTURE.md
- error ทุกเส้น `{ code, message, details? }` · request body ใช้ `z.strictObject`
- `@supertrees/contracts` ติดตั้งจาก `vendor/*.tgz` (อัปเดต: `npm run pack:vendor` ใน st-contracts แล้ว `bun install`)
- เปลี่ยน schema: แก้ `src/db/schema.ts` → `bun run db:generate` → commit ไฟล์ใน `drizzle/` (ห้ามแก้ไฟล์ที่ apply แล้ว)
