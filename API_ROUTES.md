# API_ROUTES.md — ทะเบียนเส้น API + route ของ Kong

กฎ:
- ตั้งชื่อเส้นตาม**โดเมนธุรกิจ** ไม่ผูกชื่อ service (ย้ายโดเมนไป service อื่น = แก้แค่ upstream ใน Kong)
- prefix `/api/v1/` · resource เป็นพหูพจน์ kebab-case · GeoJSON `[lng, lat]`
- เพิ่ม/แก้เส้น = อัปเดตไฟล์นี้ + `st-infra/kong/kong.yml` + README ของ service · เปลี่ยนชื่อ/ลบ = เพิ่มแถวใน [API_ROUTES_HISTORY.md](API_ROUTES_HISTORY.md)

สถานะ: ⏳ แผน · 🟡 มีโค้ดแต่ยังไม่ทดสอบ · ✅ ใช้งานได้

## Route ของ Kong

| path prefix | upstream | ต้อง login | หมายเหตุ |
|---|---|---|---|
| `/api/v1/parcels` | st-parcel-service:3001 | ✅ | |
| `/api/v1/listings` | st-listing-service:3002 | ⏳ (ค้นหาอาจเปิดสาธารณะ — AUTH_ROLE คำถามค้าง) | |
| `/api/v1/gardens`, `/api/v1/tree-species` | st-garden-service:3003 | ✅ | |
| `/api/v1/notifications` | st-notification-service:3004 | ✅ | |

## เส้น API

> Kong ยังไม่ตรวจ JWT (MOCK-006) · เส้นที่ "ต้อง login" ตรวจที่ service ตาม `AUTH_MODE` (MOCK-002) จนกว่าจะทำ TASK-003

| method | path | service | หน้าที่ | หน้าบ้านที่เรียก | สถานะ |
|---|---|---|---|---|---|
| GET | `/api/v1/parcels/health` | parcel | health + PostGIS (ไม่ต้อง login) | — | 🟡 |
| GET | `/api/v1/listings/health` | listing | health (ไม่ต้อง login) | — | 🟡 |
| GET | `/api/v1/gardens/health` | garden | health (ไม่ต้อง login) | — | 🟡 |
| GET | `/api/v1/notifications/health` | notification | health (ไม่ต้อง login) | — | 🟡 |
| GET | `/api/v1/parcels?bbox=` | parcel | แปลงของฉันในกรอบแผนที่ | mfe-map | ⏳ |
| POST | `/api/v1/parcels` | parcel | สร้างแปลง (GeoJSON) → คืนพื้นที่/เส้นรอบรูป | mfe-map | ⏳ |
| GET/PUT/DELETE | `/api/v1/parcels/{id}` | parcel | ดู/แก้/ลบแปลงของฉัน | mfe-map | ⏳ |
| POST | `/api/v1/parcels/measure` | parcel | วัดพื้นที่/ระยะของ geometry โดยไม่บันทึก | mfe-map | ⏳ |
| GET | `/api/v1/listings/search?bbox=&priceMin=&priceMax=&areaMin=&areaMax=&deedType=` | listing | ค้นหาประกาศ + หมุดราคา | mfe-listing, mfe-map | ⏳ |
| POST | `/api/v1/listings` | listing | สร้างประกาศจากแปลงของฉัน | mfe-listing | ⏳ |
| GET/PUT | `/api/v1/listings/{id}` | listing | ดู/แก้ประกาศ | mfe-listing | ⏳ |
| GET/POST | `/api/v1/gardens/{parcelId}/plantings` | garden | รายการ/เพิ่มการปลูกบนแปลง | mfe-garden | ⏳ |
| GET | `/api/v1/tree-species` | garden | master ชนิดพันธุ์ไม้ | mfe-garden | ⏳ |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/upload-url` | garden | ขอ signed URL อัปโหลดภาพมุมสูง (ตรวจชนิด/ขนาด) — TASK-010 | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/analyze` | garden | วิเคราะห์ภาพ **ไม่บันทึก**: `{ objectPath, boundaryPx, controlPoints? \| assumedSpacingM? }` → `TreeSurveyAnalysisDto` — TASK-012 | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/preview` | garden | พรีวิวการแก้ผล**ที่ยังไม่บันทึก** (ส่งบริบทภาพมาเอง + `points`, `grid?`, `fillGaps?`) → `TreeSurveyPreviewDto` — TASK-012 | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys` | garden | **บันทึก**ผลการนับ: `{ objectPath, boundaryPx, controlPoints? \| assumedSpacingM?, name?, result?: { points, grid?, detectionMethod, edited } }` — มี `result` = ใช้ผลที่ผู้ใช้ตรวจแล้ว (ไม่ตรวจจับซ้ำ) · ไม่มี = ตรวจจับแล้วบันทึก (sync, ภาพ ≤ 4096 px) — CONF-005/TASK-012 | mfe-garden | 🟡 |
| GET | `/api/v1/gardens/{parcelId}/tree-surveys?page=&size=` · `/{surveyId}` | garden | รายการ (`Page`)/ผลการนับของแปลง (เฉพาะของผู้ใช้) | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/tree-surveys/{surveyId}/preview` | garden | คำนวณผลจากจุด/กริดที่แก้ โดยไม่บันทึก: `{ points, grid?, fillGaps? }` → `TreeSurveyPreviewDto` (editor เรียกทุกครั้งที่แก้) | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/planting-plans/preview` | garden | คำนวณตำแหน่งต้นไม้: `{ boundary: [lng,lat][] (3–200), spacingM, angleDeg?, offsetM?, removed?, extras? }` → `PlantingPlanLayoutDto` + `gridLines` (ไม่บันทึก) — TASK-011 | mfe-garden | 🟡 |
| POST | `/api/v1/gardens/{parcelId}/planting-plans` | garden | บันทึกแผนปลูก (+ `name`) → `PlantingPlanDto` · ตรวจ `ST_IsValid` | mfe-garden | 🟡 |
| GET | `/api/v1/gardens/{parcelId}/planting-plans/{planId}/compare?surveyId=&toleranceM=` | garden | เทียบแผนกับผลนับที่ผูกแผนที่ → `PlanComparisonDto` (คำนวณสด) — TASK-012 | mfe-garden | 🟡 |
| GET | `/api/v1/gardens/{parcelId}/planting-plans?page=&size=` · `/{planId}` | garden | รายการ/แผนปลูก (เฉพาะของผู้ใช้) | mfe-garden | 🟡 |
| PUT | `/api/v1/gardens/{parcelId}/planting-plans/{planId}` | garden | บันทึกการแก้ไขแผน (ชื่อ/ระยะ/มุม/เลื่อนกริด/ลบ-เพิ่มหมุด) → `PlantingPlanDto` (`FOR UPDATE`, แทนที่ต้นไม้) | mfe-garden | 🟡 |
| PUT | `/api/v1/gardens/{parcelId}/tree-surveys/{surveyId}` | garden | บันทึกจุด/กริดที่แก้: `{ points, grid? }` → `TreeSurveyDto` (แทนที่ต้นไม้ทั้งหมด, `FOR UPDATE`) | mfe-garden | 🟡 |
