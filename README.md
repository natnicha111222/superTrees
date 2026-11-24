# superTrees (PoC)

เว็บแอป (ระยะนี้ทำเว็บก่อน — แอปมือถือพักไว้ที่ [TASK-009](tasks/TASK-009.md)) สำหรับซื้อ-ขาย/วิเคราะห์ที่ดินบนแผนที่ และจัดการต้นไม้/สวนบนแปลง

> สถานะ 2026-11-23: โครงทุก repo เสร็จ (TASK-002 ✅) + ฟีเจอร์นับต้นไม้จากภาพ (TASK-010 🟡) — รันครบทั้งระบบบนเครื่อง local แล้ว (ดู [TASKS.md](TASKS.md))

## Tech stack

| ชั้น | เทคโนโลยี |
|---|---|
| แอป | Ionic + Angular 21+ (standalone, signals) — เว็บ · Capacitor (มือถือ) ภายหลัง |
| micro frontend | Native Federation (`@angular-architects/native-federation`) |
| หลังบ้าน | Bun + Hono + Drizzle ORM + zod — microservice แยก repo |
| Auth / DB / ไฟล์ | Supabase (Auth, Postgres + PostGIS, Storage) |
| gateway | Kong (DB-less) |
| event | RabbitMQ |
| รัน/deploy | Docker / docker-compose |

## โครงสร้าง

root นี้เป็น repo เอกสารกลาง · โฟลเดอร์ `st-*` แต่ละตัวเป็น git repo แยก — รายชื่อ/port ที่ [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) · สถาปัตยกรรมที่ [ARCHITECTURE.md](ARCHITECTURE.md)

## เครื่องมือที่ต้องติดตั้ง

- Node.js LTS (สำหรับ Angular CLI) + Bun
- Docker Desktop
- Supabase CLI
- ~~Android Studio / Xcode~~ — ยังไม่ต้อง (ทำเว็บก่อน)
- Supabase CLI ไม่ต้องติดตั้ง — ใช้ `npx supabase@3.2.0` · Angular CLI ใช้ของในแต่ละ repo (`npx ng`) ไม่ใช้ตัว global

## วิธีรัน

1. เปิด Docker Desktop
2. `st-infra`: ทำตามหัวข้อ "เริ่มครั้งแรก" ใน `st-infra/README.md` (Supabase local, Kong, RabbitMQ, กรอก `.env` ของแต่ละ service, `bun run db:migrate`)
3. หลังบ้านทุก service: `cd st-infra && npm run dev:backend`
4. หน้าบ้านทุก remote + shell: `cd st-infra && npm run dev:frontend` (อีกหน้าต่าง) — หรือ `npm run dev` รวมทั้งสองกลุ่ม
5. เปิด http://localhost:4200 → เมนู "สวน / นับต้นไม้"

ครั้งแรกต้อง `npm install` (หน้าบ้าน, contracts, shared-ui) / `bun install` (service) ในแต่ละ repo
