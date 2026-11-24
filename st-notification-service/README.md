# st-notification-service

consume event จาก RabbitMQ → สร้างการแจ้งเตือน in-app / push (device token)

> สถานะ: ✅ โครง TASK-002 (ทดสอบกับ DB/RabbitMQ local แล้ว) — รับ event แล้ว log + กันซ้ำด้วย `eventId` · การแจ้งเตือนจริงมาใน TASK ภายหลัง

- stack: Bun + Hono + Drizzle ORM + zod + amqplib · port (dev): 3004
- schema: `notify` (ห้าม query schema อื่น) · bucket: ไม่มี

## Endpoints
| method | path | login | หมายเหตุ |
|---|---|---|---|
| GET | `/api/v1/notifications/health` | ไม่ต้อง | |

## Schema / ตาราง
- `notify.processed_events` (`event_id` uuid PK, `type`, `processed_at`) — consumer idempotent · RLS เปิด

## Event
- consume ที่ queue `notification.events` (+ DLQ `notification.events.dlq` ผ่าน exchange `supertrees.events.dlx`): `system.service.started`, `garden.tree-survey.completed`
- publish `system.service.started` ตอนเริ่ม
- ประมวลผลไม่สำเร็จ → nack ไป DLQ (ไม่วนซ้ำ)

## env var (`.env.example`)
`APP_ENV` · `PORT` · `HOST` · `DATABASE_URL` (ค่าลับ) · `RABBITMQ_URL` (ค่าลับ) · `AUTH_MODE`

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
