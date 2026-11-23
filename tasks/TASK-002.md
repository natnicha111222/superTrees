# TASK-002 — โครง hello-world ทุก repo + docker-compose รันได้ครบ

**สถานะ:** ⏳ ยังไม่เริ่ม · **repo:** ทุก repo

## เป้าหมาย
เปิดแอปแล้วเห็น shell โหลด remote 1 ตัว ที่เรียก `GET /api/v1/parcels/health` ผ่าน Kong → parcel-service → query PostGIS (`SELECT postgis_version()`) ได้ + publish/consume event ทดสอบ 1 ตัวผ่าน RabbitMQ

## ขั้นตอน (ลำดับ)
1. st-infra: `docker-compose.yml` (Kong DB-less, RabbitMQ + management), `kong/kong.yml`, `.env.example`, คำสั่ง `supabase init/start` + เปิด extension `postgis`
2. st-contracts: package TS + type envelope ของ event + `npm pack`
3. st-parcel-service: Bun + Hono + Drizzle template ตามโครงใน PROJECT_STRUCTURE.md + Dockerfile (ใช้เป็นต้นแบบ service อื่น)
4. service ที่เหลือ: copy โครงจาก parcel (เส้น health อย่างเดียว)
5. st-shared-ui: Angular library + theme token เริ่มต้น + `THEME.md`
6. st-shell: Ionic + Angular + Capacitor + native federation host + `federation.manifest.json`
7. st-mfe-*: remote expose `./routes`
8. กรอกตารางเวอร์ชันใน PROJECT_STRUCTURE.md

## ต้องตัดสินใจก่อน
- CONF-001 (ข้อ 6 ส่วนมือถือ — ทำเว็บก่อนได้)

## บัคที่เจอ
- ยังไม่มี
