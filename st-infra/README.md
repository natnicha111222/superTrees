# st-infra

config สำหรับรันทั้งระบบด้วย Docker

> สถานะ: 🟡 TASK-002 — Supabase local + Kong + RabbitMQ + สคริปต์รัน dev

| ส่วน | ไฟล์ | port (dev, ผูก 127.0.0.1) |
|---|---|---|
| Supabase local (Auth, Postgres 17 + PostGIS 3.3, Storage, Studio) | `supabase/config.toml`, `supabase/migrations/` (ส่วนกลางเท่านั้น: เปิด PostGIS) | 54321 API · 54322 DB · 54323 Studio · 54324 อีเมลทดสอบ |
| Kong 3.9 (DB-less) | `docker-compose.yml`, `kong/kong.yml` | 8000 proxy · admin ปิด |
| RabbitMQ 4.1 + management | `docker-compose.yml` | 5672 · 15672 (UI) |
| services (dev) | รันบนเครื่องด้วย `npm run dev:backend` — Kong เรียกผ่าน `host.docker.internal:300x` | 3001–3004 |

bucket (private ทั้งหมด) ตั้งใน `supabase/config.toml`: `garden-photos` (JPEG/PNG ≤ 20 MiB) · `listing-photos` · `title-deeds` (PDPA) — ปิด realtime / edge runtime / analytics ตอน dev

## เริ่มครั้งแรก

```bash
cd st-infra
cp .env.example .env                    # ตั้ง RABBITMQ_PASSWORD เอง (ห้าม commit)
npx supabase@3.2.0 start                # ครั้งแรกดึง image นาน · ต้องเปิด Docker Desktop
docker compose up -d                    # Kong + RabbitMQ
npx supabase@3.2.0 status -o env        # ⚠️ แสดงค่าลับ local (DB URL, service_role key) สำหรับ .env ของ service
```

แต่ละ service: `cp .env.example .env` แล้วกรอก `DATABASE_URL` (DB URL จาก status), `RABBITMQ_URL` (`amqp://supertrees:<RABBITMQ_PASSWORD>@127.0.0.1:5672`) และสำหรับ garden `SUPABASE_SERVICE_ROLE_KEY` (secret/service_role key จาก status) · `AUTH_MODE=dev-fixed-user` ถ้าจะลองเส้นที่ต้อง login (MOCK-002) → แล้ว `bun run db:migrate` ในแต่ละ service

ปิด: `docker compose down` · `npx supabase@3.2.0 stop` (ข้อมูลยังอยู่ · ล้างทั้งหมด `--no-backup`)

## Kong (`kong/kong.yml`)
- route ตาม API_ROUTES.md (`strip_path: false`) · CORS allowlist `http://localhost:4200–4203` · ทิ้ง `X-User-Id/Role/Email` · rate limit 300/นาที · body ≤ 1 MB
- ⚠️ MOCK-006: ยังไม่ตรวจ JWT (รอ CONF-002 / TASK-003) — service ตรวจเองตาม `AUTH_MODE`
- ตรวจไฟล์: `docker run --rm -e KONG_DATABASE=off -v "$PWD/kong/kong.yml:/kong.yml:ro" kong:3.9 kong config parse /kong.yml` · แก้แล้ว `docker compose restart kong`

## รันทุก repo พร้อมกัน (dev)

```bash
cd st-infra
npm run dev:backend    # parcel 3001 · listing 3002 · garden 3003 · notification 3004  (bun run dev)
npm run dev:frontend   # mfe-map 4201 · mfe-listing 4202 · mfe-garden 4203 · shell 4200  (npm run dev)
npm run dev            # ทั้งสองกลุ่มในหน้าต่างเดียว
```

- ไม่ต้อง `npm install` (สคริปต์ไม่มี dependency · ต้องมี Node 18+, Bun, npm)
- รันพร้อมกันใน terminal เดียว output ติดป้ายชื่อ repo · **Ctrl+C หยุดทุกตัว** (รวม process ลูก)
- ข้ามพร้อมแจ้งเหตุผล: ไม่มีโฟลเดอร์ / ไม่มี `package.json` หรือ script `dev` / port ถูกใช้อยู่แล้ว / ไม่มี bun หรือ npm ใน PATH
- ตัวหนึ่งตาย ตัวอื่นรันต่อ · เลือกบางตัว: `ST_ONLY=parcel,garden npm run dev:backend` (bash) หรือ `$env:ST_ONLY='parcel'; npm run dev:backend` (PowerShell)
- หา repo จากโฟลเดอร์แม่ของ st-infra — ถ้าวาง repo ที่อื่นตั้ง `ST_WORKSPACE`
- **ข้อตกลงทุก repo:** มี script `dev` ใน `package.json` · service อ่าน port จาก env `PORT` (สคริปต์ส่งให้) และฟังที่ `127.0.0.1` · หน้าบ้านตั้ง port ใน `angular.json` ให้ตรงตาราง
- `dev:backend` รันเฉพาะ service — Supabase กับ Kong/RabbitMQ ต้องเปิดก่อน (หัวข้อ "เริ่มครั้งแรก")
- ตาราง port อยู่ใน `scripts/dev.mjs` (`REPOS`) ต้องตรงกับ PROJECT_STRUCTURE.md ของ workspace


## หมายเหตุ
- ค่าลับอยู่ `.env` (copy จาก `.env.example`, ignore ไว้) · ค่า local ให้ Claude สร้างได้ ค่า uat/prod ผู้ใช้สร้างเอง (CLAUDE.md)
- route ของ Kong ต้องตรงกับ API_ROUTES.md ของ workspace
- ⏳ deploy: service เป็น container ใน network เดียวกับ Kong (ไม่ publish port) — ยังไม่ทำ
