# ARCHITECTURE.md — สถาปัตยกรรม superTrees

สถานะ: **แผน (ยังไม่มีโค้ด)** · ส่วนที่ยังไม่ตัดสินใจอ้าง CONF

## ภาพรวม

```
 ┌──────── Ionic web app (เบราว์เซอร์ · มือถือผ่าน Capacitor ภายหลัง) ────────┐
 │  st-shell (host) ── loadRemoteModule ──► st-mfe-map / -listing / -garden │
 └───────┬──────────────────────────────┬──────────────────────────────────┘
         │ login / refresh              │ /api/v1/**  (Bearer JWT)
         ▼                              ▼
  ┌──────────────┐               ┌──────────────┐  ตรวจ JWT, ทิ้ง X-User-*,
  │ Supabase Auth│               │  Kong :8000  │  CORS, rate limit
  └──────────────┘               └──────┬───────┘
                                        │ (docker network ภายใน)
            ┌───────────────┬───────────┼────────────────┐
            ▼               ▼           ▼                ▼
      parcel-service  listing-service  garden-service  notification-service
            │   \           │   \        │   \              ▲
            │    └──────────┴────┴───────┴────┴─ publish ──► RabbitMQ ─┘ consume
            ▼               ▼                ▼
      ┌──────────── Supabase Postgres + PostGIS ─────────────┐
      │ schema: parcel │ listing │ garden │ notify │ (auth)   │
      └───────────────────────────────────────────────────────┘
      Supabase Storage (private buckets, signed URL จาก service)
```

## Flow

### 1. Login
แอป → `supabase-js` (Auth) → ได้ access token (JWT) + refresh token → shell เก็บ session (เว็บ: storage ของ `supabase-js` ในเบราว์เซอร์ · มือถือภายหลังใช้ secure storage ของ Capacitor — TASK-009) → interceptor แนบ `Authorization: Bearer` เฉพาะเส้น `/api/` · role อยู่ใน claim `app_metadata.role` ([AUTH_ROLE.md](AUTH_ROLE.md))

### 2. เรียก API
แอป → Kong ตรวจลายเซ็น/หมดอายุของ JWT ([CONF-002](conf/CONF-002.md)) → forward ไป service → middleware ของ service **ตรวจ JWT ซ้ำ** แล้วได้ `userId = sub`, `role` → service ตรวจความเป็นเจ้าของ (`owner_id = userId`) ทุกครั้งที่แตะข้อมูลรายตัว

### 3. ไฟล์ (Storage)
1. แอปขอ upload URL จาก service เจ้าของ (`POST /api/v1/parcels/{id}/title-deeds/upload-url` พร้อม ชนิด/ขนาด)
2. service ตรวจสิทธิ์ + ชนิด/ขนาด → สร้าง object path `<ownerId>/<uuid>.<ext>` → ออก signed upload URL อายุสั้น
3. แอปอัปโหลดตรงไป Supabase Storage
4. แอปแจ้ง service ว่าอัปโหลดเสร็จ → service ตรวจว่าไฟล์มีจริง (+ magic bytes ถ้าทำได้) → บันทึก **path** ลง DB
5. ดูไฟล์ = ขอ signed download URL จาก service ทุกครั้ง (ไม่เก็บ URL)

### 4. นับต้นไม้จากภาพมุมสูง (TASK-010 · [CONF-005](conf/CONF-005.md))
1. หน้าบ้านย่อภาพให้ด้านยาว ≤ 4096 px → อัปโหลดเข้า bucket `garden-photos` ตามข้อ 3
2. ผู้ใช้คลิกขอบเขตแปลงบนภาพ + ปักจุดคู่ภาพ↔แผนที่ ≥ 3 จุด (หรือข้าม แล้วระบุระยะปลูก = ผลแบบประมาณ)
3. `POST …/tree-surveys/analyze` → garden-service ดึงภาพจาก Storage, decode, ประมวลผล **แบบ sync** → คืนผล **ยังไม่บันทึก** → ผู้ใช้ตรวจ/แก้ (พรีวิวร่าง `POST …/tree-surveys/preview`) + ตั้งชื่อ → `POST …/tree-surveys` พร้อม `result` = บันทึก (TASK-012)
4. พิกัดภาพ → UTM (EPSG:32647/32648) ด้วย affine → `[lng, lat]` · ระยะวัดบน UTM
5. แก้ไขผล: หน้าบ้านส่งจุด + ค่ากริดไป `…/{id}/preview` ทุกครั้งที่แก้ (ไม่บันทึก) → `PUT …/{id}` บันทึก — คำนวณที่ service ด้วยโค้ดเดียวกับตอนนับเสมอ

### 5. วางแผนปลูก (TASK-011)
แผนที่ (MapLibre) → ผู้ใช้ปักมุมแปลง [lng, lat] + ระยะปลูก → `POST …/planting-plans/preview` (debounce + switchMap) → garden-service: `ST_IsValid` (PostGIS) → คำนวณบน UTM (แนวแถวตามขอบแรก) → `[lng, lat]` ของแต่ละต้น → บันทึก `POST …/planting-plans` (Polygon/Point 4326 + GIST) → publish `garden.planting-plan.created`

### 6. เทียบแผนปลูกกับผลนับ (TASK-012)
`GET …/planting-plans/{id}/compare?surveyId=` → garden-service อ่านหลุมตามแผน + ต้นที่ตรวจพบ ([lng, lat] จากการผูกแผนที่) → จับคู่บน UTM (ใกล้สุดก่อน ภายในครึ่งระยะปลูก) → หลุมมีต้น/ว่าง/ต้นนอกแผน · คำนวณสด · ทั้งสองฟีเจอร์ใช้แกนกริดร่วม `services/grid/core.ts`

### 7. Event
service ทำงานเสร็จ + commit → publish ไป exchange `supertrees.events` (topic) → consumer ที่ผูก routing key รับไป · รายละเอียดที่ [EVENTS.md](EVENTS.md)

## รันตอน dev (TASK-002)

```
เบราว์เซอร์ ── http://localhost:4200 (shell) ──► remoteEntry ของ 4201–4203 (ng serve บนเครื่อง)
     │ /api/v1/**                     │ PUT/GET ไฟล์ด้วย signed URL
     ▼                                ▼
 Kong :8000 (docker) ──host.docker.internal──► service 3001–3004 (bun บนเครื่อง, ฟัง 127.0.0.1)
                                                 │ DATABASE_URL          │ RABBITMQ_URL
                                                 ▼                       ▼
                         Supabase local (CLI, docker) :54321/54322   RabbitMQ :5672 (docker)
```

- service รันบนเครื่อง (`npm run dev:backend`) ไม่อยู่ใน docker ตอน dev → Kong เรียกผ่าน `host.docker.internal` · port ทุกตัวผูก 127.0.0.1
- ตอน deploy (⏳): service เป็น container ใน network เดียวกับ Kong ไม่ publish port
- ภาพของ TASK-010 ไม่ผ่าน Kong/service ตอนอัปโหลด: service ออก signed upload URL → เบราว์เซอร์ PUT ตรงไป Storage → service ดาวน์โหลดมาประมวลผลเอง

## ความเป็นเจ้าของข้อมูล

| schema | เจ้าของ | ตารางหลัก (แผน) |
|---|---|---|
| `parcel` | st-parcel-service | `parcels` (geometry, พื้นที่ ตร.ม., ประเภทเอกสารสิทธิ์, owner_id), `title_deed_files` |
| `listing` | st-listing-service | `listings` (parcel_id, ราคา, สถานะ, จุดแสดงบนแผนที่), `listing_photos`, `parcel_snapshots` (สำเนาจาก event) |
| `garden` | st-garden-service | `plantings` (parcel_id, ชนิดพืช, จุด/พื้นที่, จำนวน, วันปลูก), `tree_species` (master) · มีแล้ว: `tree_surveys`, `tree_survey_trees` (TASK-010), `planting_plans` (Polygon 4326), `planting_plan_trees` (TASK-011) |
| `notify` | st-notification-service | `notifications`, `device_tokens`, `processed_events` (มีแล้ว) |

- ข้อมูล master (ชนิดเอกสารสิทธิ์, ชนิดพันธุ์ไม้, จังหวัด) เป็นตารางใน schema ของ service ที่ใช้ และเปิดผ่าน API — ไม่ทำ enum ตายตัวในหน้าบ้าน
- RLS: เปิดทุกตารางใน schema ธุรกิจ และ **ไม่ให้ role `anon`/`authenticated` เข้าถึง** (เข้าถึงผ่าน service เท่านั้น) — service ใช้ DB role ของตัวเองที่ได้สิทธิ์แค่ schema ตัวเอง

## ข้อมูลภูมิศาสตร์

- แปลง = `geometry(MultiPolygon, 4326)` · หมุด/ต้นไม้ = `geometry(Point, 4326)` · index GIST ทุกคอลัมน์ geometry
- พื้นที่/เส้นรอบรูป คำนวณที่หลังบ้านตอนบันทึก (`ST_Area(geom::geography)`, `ST_Perimeter(geom::geography)`) แล้วเก็บไว้ · หน้าบ้านคำนวณแบบประมาณได้เพื่อแสดงสด แต่ค่าที่บันทึกมาจากหลังบ้าน
- ความชัน/เส้นชั้นความสูงต้องใช้ข้อมูลความสูง (DEM) — แหล่งข้อมูลรอตัดสินใจ [CONF-003](conf/CONF-003.md)
- ไลบรารีแผนที่หน้าบ้าน = **MapLibre GL** · ภาพดาวเทียม Esri World Imagery (PoC — MOCK-007) · แหล่ง tile อยู่ใน runtime config ([CONF-006](conf/CONF-006.md))
- remote ที่ใช้ MapLibre ต้อง copy `maplibre-gl.css` + `maplibre-gl-worker.mjs` เป็น asset แล้วอ้างจาก origin ของตัวเอง (`setWorkerUrl`) — federation รวม package จน worker หาไฟล์ตัวเองไม่เจอ และ global style ของ remote ไม่ถูกโหลดใน shell
