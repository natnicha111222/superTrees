# superTrees (PoC)

แอปมือถือ + เว็บ สำหรับซื้อ-ขาย/วิเคราะห์ที่ดินบนแผนที่ และจัดการต้นไม้/สวนบนแปลง

> สถานะ 2026-11-23: มีแค่เอกสาร + โฟลเดอร์ repo ว่าง — ยังรันไม่ได้ (ดู [TASKS.md](TASKS.md))

## Tech stack

| ชั้น | เทคโนโลยี |
|---|---|
| แอป | Ionic + Angular 21+ (standalone, signals) + Capacitor |
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
- Android Studio (Android) · Xcode บน macOS (iOS)

## วิธีรัน

⏳ จะเขียนตอน TASK-002 — ลำดับคร่าว ๆ: `supabase start` → `docker compose up` ใน `st-infra` → `bun dev` แต่ละ service → `ng serve` remote แต่ละตัว → `ng serve` shell
