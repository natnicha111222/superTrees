# st-parcel-service

แปลงที่ดิน

> สถานะ: ✅ โครง TASK-002 (ทดสอบกับ DB/RabbitMQ local แล้ว) (เส้น health + publish event ตอนเริ่ม) · โดเมนจริงมาใน TASK ของโดเมน

- stack: Bun + Hono + Drizzle ORM + zod · port (dev):  geometry (PostGIS), พื้นที่/เส้นรอบรูป, ประเภทเอกสารสิทธิ์, ไฟล์โฉนด, (ภายหลัง) ความชัน/ความสูง · ฟังที่ `127.0.0.1`
- schema: `3001` (ห้าม query schema อื่น) · parcels:bucket `title-deeds` (private, PDPA)

## Endpoints
| method | path | login | หมายเหตุ |
|---|---|---|---|
| GET | `/api/v1/parcel/health` | ไม่ต้อง | 200 `{ status: 'ok', checks.postgis }` · DB ล่ม = 503 `degraded` |

## Schema / ตาราง
- `3001` — ยังไม่มีตาราง (migration `0000_init` สร้างแค่ schema)

## Event
- publish `system.service.started` ตอนเริ่ม (ทดสอบเส้นทาง event — EVENTS.md)

## env var (`.env.example`)
`APP_ENV` · `PORT` · `HOST` · `DATABASE_URL` (ค่าลับ) · `RABBITMQ_URL` (ค่าลับ) · `AUTH_MODE` (`disabled` ค่าเริ่มต้น / `dev-fixed-user` = MOCK-002 local เท่านั้น) · `DEV_USER_ID`

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
