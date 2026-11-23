# ARCHITECTURE.md — สถาปัตยกรรม superTrees

สถานะ: **แผน (ยังไม่มีโค้ด)** · ส่วนที่ยังไม่ตัดสินใจอ้าง CONF

## ภาพรวม

```
 ┌──────────── Ionic app (เว็บ / Android / iOS ผ่าน Capacitor) ────────────┐
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
แอป → `supabase-js` (Auth) → ได้ access token (JWT) + refresh token → shell เก็บ session (บนมือถือใช้ secure storage ของ Capacitor — ⏳ เลือก plugin ใน TASK-003) → interceptor แนบ `Authorization: Bearer` เฉพาะเส้น `/api/` · role อยู่ใน claim `app_metadata.role` ([AUTH_ROLE.md](AUTH_ROLE.md))

### 2. เรียก API
แอป → Kong ตรวจลายเซ็น/หมดอายุของ JWT ([CONF-002](conf/CONF-002.md)) → forward ไป service → middleware ของ service **ตรวจ JWT ซ้ำ** แล้วได้ `userId = sub`, `role` → service ตรวจความเป็นเจ้าของ (`owner_id = userId`) ทุกครั้งที่แตะข้อมูลรายตัว

### 3. ไฟล์ (Storage)
1. แอปขอ upload URL จาก service เจ้าของ (`POST /api/v1/parcels/{id}/title-deeds/upload-url` พร้อม ชนิด/ขนาด)
2. service ตรวจสิทธิ์ + ชนิด/ขนาด → สร้าง object path `<ownerId>/<uuid>.<ext>` → ออก signed upload URL อายุสั้น
3. แอปอัปโหลดตรงไป Supabase Storage
4. แอปแจ้ง service ว่าอัปโหลดเสร็จ → service ตรวจว่าไฟล์มีจริง (+ magic bytes ถ้าทำได้) → บันทึก **path** ลง DB
5. ดูไฟล์ = ขอ signed download URL จาก service ทุกครั้ง (ไม่เก็บ URL)

### 4. Event
service ทำงานเสร็จ + commit → publish ไป exchange `supertrees.events` (topic) → consumer ที่ผูก routing key รับไป · รายละเอียดที่ [EVENTS.md](EVENTS.md)

## ความเป็นเจ้าของข้อมูล

| schema | เจ้าของ | ตารางหลัก (แผน) |
|---|---|---|
| `parcel` | st-parcel-service | `parcels` (geometry, พื้นที่ ตร.ม., ประเภทเอกสารสิทธิ์, owner_id), `title_deed_files` |
| `listing` | st-listing-service | `listings` (parcel_id, ราคา, สถานะ, จุดแสดงบนแผนที่), `listing_photos`, `parcel_snapshots` (สำเนาจาก event) |
| `garden` | st-garden-service | `plantings` (parcel_id, ชนิดพืช, จุด/พื้นที่, จำนวน, วันปลูก), `tree_species` (master) |
| `notify` | st-notification-service | `notifications`, `device_tokens`, `processed_events` |

- ข้อมูล master (ชนิดเอกสารสิทธิ์, ชนิดพันธุ์ไม้, จังหวัด) เป็นตารางใน schema ของ service ที่ใช้ และเปิดผ่าน API — ไม่ทำ enum ตายตัวในหน้าบ้าน
- RLS: เปิดทุกตารางใน schema ธุรกิจ และ **ไม่ให้ role `anon`/`authenticated` เข้าถึง** (เข้าถึงผ่าน service เท่านั้น) — service ใช้ DB role ของตัวเองที่ได้สิทธิ์แค่ schema ตัวเอง

## ข้อมูลภูมิศาสตร์

- แปลง = `geometry(MultiPolygon, 4326)` · หมุด/ต้นไม้ = `geometry(Point, 4326)` · index GIST ทุกคอลัมน์ geometry
- พื้นที่/เส้นรอบรูป คำนวณที่หลังบ้านตอนบันทึก (`ST_Area(geom::geography)`, `ST_Perimeter(geom::geography)`) แล้วเก็บไว้ · หน้าบ้านคำนวณแบบประมาณได้เพื่อแสดงสด แต่ค่าที่บันทึกมาจากหลังบ้าน
- ความชัน/เส้นชั้นความสูงต้องใช้ข้อมูลความสูง (DEM) — แหล่งข้อมูลรอตัดสินใจ [CONF-003](conf/CONF-003.md)
- ไลบรารีแผนที่หน้าบ้าน ⏳ (ตัวเลือก: MapLibre GL — vector tile, ไม่มีค่าไลเซนส์ / Leaflet) ตัดสินใจใน TASK-004
