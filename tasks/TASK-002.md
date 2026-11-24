# TASK-002 — โครง hello-world ทุก repo + docker-compose รันได้ครบ

**สถานะ:** ✅ เสร็จ (2026-11-23) · **repo:** ทุก repo

## เป้าหมาย
เปิดแอปแล้วเห็น shell โหลด remote 1 ตัว ที่เรียก `GET /api/v1/parcels/health` ผ่าน Kong → parcel-service → query PostGIS (`SELECT postgis_version()`) ได้ + publish/consume event ทดสอบ 1 ตัวผ่าน RabbitMQ

## ขั้นตอน (ลำดับ)
1. st-infra: `docker-compose.yml` (Kong DB-less, RabbitMQ + management), `kong/kong.yml`, `.env.example`, คำสั่ง `supabase init/start` + เปิด extension `postgis`
2. st-contracts: package TS + type envelope ของ event + `npm pack`
3. st-parcel-service: Bun + Hono + Drizzle template ตามโครงใน PROJECT_STRUCTURE.md + Dockerfile (ใช้เป็นต้นแบบ service อื่น)
4. service ที่เหลือ: copy โครงจาก parcel (เส้น health อย่างเดียว)
5. st-shared-ui: Angular library + theme token เริ่มต้น + `THEME.md`
6. st-shell: Ionic + Angular + native federation host + `federation.manifest.json` (**เว็บอย่างเดียว ไม่ติดตั้ง Capacitor**)
7. st-mfe-*: remote expose `./routes`
8. กรอกตารางเวอร์ชันใน PROJECT_STRUCTURE.md
9. ทุก service/remote/shell: script `dev` ใน `package.json` ฟัง env `PORT` (service: `bun --watch`, ฟัง `127.0.0.1`) → ทดสอบ `npm run dev:backend` / `dev:frontend` ใน st-infra (สคริปต์มีแล้ว — STR-004) · `kong.yml` ของ dev ชี้ upstream ไป `host.docker.internal:<port>`

## ผลการทำ (2026-11-23)
ลำดับ release ตามที่ทำ: contracts 0.1.0 → services ×4 → shared-ui 0.1.0→0.1.1 → remotes ×3 → shell → infra · เวอร์ชันทั้งหมดในตารางข้อ 4 ของ PROJECT_STRUCTURE.md

- [x] st-infra: Supabase local (`supabase/config.toml` + migration เปิด PostGIS, bucket private 3 ตัว), `docker-compose.yml` (Kong 3.9 DB-less + RabbitMQ 4.1), `kong/kong.yml`, `.env.example`
- [x] st-contracts: type ส่วนกลาง + event envelope + DTO TASK-010 · `npm run pack:vendor` แจก tarball (ผู้ใช้เลือก vendor/ — STR-005)
- [x] service ×4: Hono + Drizzle + zod ตามโครงมาตรฐาน · health (`postgis_version()`) · error กลาง · `requireAuth` (MOCK-002) · publisher (confirm channel) · migration `0000_init` · notification: consumer + DLQ + `notify.processed_events`
- [x] st-shared-ui: theme token (THEME.md) · RuntimeConfigService · apiErrorMessage · pipe วันที่ไทย/ไร่-งาน-วา/ระยะ
- [x] remote ×3: expose `./routes` · map/listing = placeholder · garden = TASK-010
- [x] st-shell: dynamic host + manifest + runtime config + เมนู + หน้า error ถ้าโหลด remote ไม่ได้
- [x] script `dev` ทุก repo → `npm run dev:frontend` / `dev:backend` ใน st-infra

## ทดสอบแล้ว
- `bun test` + `tsc`: garden 18 · parcel 3 · listing 3 · notification 4 — ผ่านทั้งหมด · shared-ui vitest 5 ผ่าน
- build production ทั้ง 4 app ผ่าน · `kong config parse` ผ่าน · Supabase local ขึ้น (PostGIS 3.3, bucket ครบ)
- Kong (docker) → service บนเครื่องผ่าน `host.docker.internal` ได้ (health + error กลาง)
- เบราว์เซอร์ (Playwright): shell โหลด remote ครบ 3 ตัว, เมนู, redirect, Ionic แบบ zoneless ทำงาน

## ทดสอบกับระบบจริง (2026-11-23 — `.env` local สร้างโดย Claude ตามที่ผู้ใช้อนุญาต)
- [x] RabbitMQ + Kong `healthy` · `bun run db:migrate` ครบ 4 service (หลังแก้ BUG-001) · ตาราง + RLS + `geometry(Point, 4326)` ถูกต้อง
- [x] health ผ่าน Kong 200 ครบ 4 service (PostGIS 3.3)
- [x] event: `system.service.started` / `garden.tree-survey.completed` ถึง notification + บันทึกใน `notify.processed_events`
- หมายเหตุ: ตอนเริ่มพร้อมกัน event `system.service.started` ของ service ที่ขึ้นก่อน notification หาย (queue ยังไม่ถูกสร้าง) — ตามคาด ไม่กระทบ event จริง

## ต้องตัดสินใจก่อน
- ไม่มี — มือถือ (CONF-001) เลื่อนไป TASK-009 · JWT (CONF-002) ไปทำใน TASK-003

## บัคที่เจอ
- [BUG-001](../bugs/BUG-001.md) · [BUG-002](../bugs/BUG-002.md)
- ข้อควรรู้เรื่องเวอร์ชัน (ไม่ใช่บัค — อยู่ในตารางเวอร์ชันของ PROJECT_STRUCTURE.md): Angular CLI 22.2 ใส่ `@angular/build ^22.3` มาให้ → pin ทุกตัว · builder `@angular/build:library` ไม่มีใน 22.2 · Ionic 9 ไม่มี `@ionic/angular/standalone`
