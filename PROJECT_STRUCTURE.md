# PROJECT_STRUCTURE.md — โครงสร้าง superTrees

อ่านก่อนสร้าง repo / โฟลเดอร์ / package / เอกสารใหม่ หรือย้ายไฟล์ · เปลี่ยนโครงเมื่อไรให้เพิ่มแถวในทะเบียน `STR-NNN` ท้ายไฟล์

## 0. การตัดสินใจหลัก (ผู้ใช้กำหนด 2026-11-23 — ห้ามเปลี่ยนเอง)

- **multirepo**: 1 โฟลเดอร์ `st-*` = 1 git repo · root เป็น repo เอกสารกลาง ไม่มีโค้ด
- **micro frontend ด้วย Native Federation** (`@angular-architects/native-federation`) — shell + remote ต่อโดเมน
- **หลังบ้าน Bun + Hono + Drizzle** (ไม่ใช้ Go — [CONF-004](conf/CONF-004.md))
- **Supabase** = Auth + Postgres/PostGIS + Storage · **Kong** = API gateway · **RabbitMQ** = event ข้าม service · **Docker** สำหรับรันทั้งชุด

## 1. แผนผัง workspace

```
D:\superTrees\                  ← repo "superTrees" (เอกสารกลาง)
├── CLAUDE.md  README.md  PROJECT_STRUCTURE.md  ARCHITECTURE.md
├── AUTH_ROLE.md  API_ROUTES.md  API_ROUTES_HISTORY.md  EVENTS.md
├── TASKS.md  BUGS.md  MOCKS.md  CODE_STANDARDS.md
├── tasks/  conf/  bugs/  security/
│
├── st-infra/                   ← docker-compose, Kong, RabbitMQ, Supabase local config
├── st-contracts/               ← @supertrees/contracts: type DTO + payload ของ event (TS)
├── st-shared-ui/               ← @supertrees/shared-ui: theme, component/pipe กลาง (Angular lib)
├── st-shell/                   ← host: Ionic + Angular + Capacitor
├── st-mfe-map/                 ← remote: แผนที่ แปลงที่ดิน เครื่องมือวัด
├── st-mfe-listing/             ← remote: ประกาศขาย ค้นหา/กรอง
├── st-mfe-garden/              ← remote: ต้นไม้/สวนบนแปลง
├── st-parcel-service/          ← Bun: แปลงที่ดิน + geometry + การวัด
├── st-listing-service/         ← Bun: ประกาศขาย ราคา ค้นหา
├── st-garden-service/          ← Bun: ต้นไม้/การปลูก ประเมินมูลค่า/คาร์บอน
└── st-notification-service/    ← Bun: consume event → แจ้งเตือน (push/in-app)
```

## 2. รายชื่อ repo

| repo | ชนิด | port (dev) | เจ้าของ schema / bucket | สถานะ |
|---|---|---|---|---|
| `st-infra` | compose + config | Kong 8000 (proxy) · RabbitMQ 5672 / 15672 | — | ⏳ ว่าง |
| `st-contracts` | TS package | — | — | ⏳ ว่าง |
| `st-shared-ui` | Angular library | — | — | ⏳ ว่าง |
| `st-shell` | Ionic host | 4200 | — | ⏳ ว่าง |
| `st-mfe-map` | remote | 4201 | — | ⏳ ว่าง |
| `st-mfe-listing` | remote | 4202 | — | ⏳ ว่าง |
| `st-mfe-garden` | remote | 4203 | — | ⏳ ว่าง |
| `st-parcel-service` | Bun service | 3001 | schema `parcel` · bucket `title-deeds` | ⏳ ว่าง |
| `st-listing-service` | Bun service | 3002 | schema `listing` · bucket `listing-photos` | ⏳ ว่าง |
| `st-garden-service` | Bun service | 3003 | schema `garden` · bucket `garden-photos` | ⏳ ว่าง |
| `st-notification-service` | Bun service | 3004 | schema `notify` | ⏳ ว่าง |

Supabase local (CLI `supabase start`): API 54321 · DB 54322 · Studio 54323 — Supabase มี Kong ภายในของตัวเองที่ 54321 **คนละตัวกับ Kong ของเรา (8000)**

## 3. โครงภายใน repo

### Bun service (`st-*-service`)

```
src/
  index.ts              ← สร้าง Hono app, middleware (auth, error, request-id)
  config.ts             ← อ่าน env + validate ด้วย zod (ไม่มี default ของค่าลับ)
  routes/               ← 1 ไฟล์ต่อกลุ่มเส้น: validate DTO → เรียก service
  services/             ← logic ทั้งหมด
  repositories/         ← Drizzle query เท่านั้น
  db/schema.ts          ← pgSchema('<ชื่อ schema>') + ตาราง
  db/client.ts
  events/publisher.ts   events/consumers/
  middleware/auth.ts    ← ตรวจ JWT ของ Supabase (ซ้ำกับ Kong โดยตั้งใจ)
drizzle/                ← ไฟล์ migration (commit ทุกไฟล์)
drizzle.config.ts  Dockerfile  .env.example  README.md
test/
```

README ของ service ต้องมีหัวข้อ: หน้าที่ · Endpoints · Schema/ตาราง · Bucket · Event ที่ publish/consume · env var

### Remote (`st-mfe-*`)

```
src/app/
  exposed/              ← ของที่ expose ผ่าน federation (routes.ts เป็นหลัก)
  pages/  components/  services/  models/
federation.config.js    ← expose + shareAll singleton strict
```

expose เป็น **routes** (`./routes`) ให้ shell `loadChildren` — ไม่ expose component ทีละตัว

### Shell (`st-shell`)

```
src/app/
  layout/  auth/  core/ (interceptor, runtime config)
  app.routes.ts         ← loadRemoteModule ต่อ remote
public/federation.manifest.json   ← ที่อยู่ remote ต่อ environment
capacitor.config.ts  android/  ios/
```

## 4. ตารางเวอร์ชัน (ต้องตรงกันทุก repo หน้าบ้าน)

| library | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Angular | ⏳ กำหนดตอน TASK-002 (21+) | |
| Ionic | ⏳ | |
| Capacitor | ⏳ | เฉพาะ shell |
| @angular-architects/native-federation | ⏳ | ต้องรองรับ Angular เวอร์ชันที่ใช้ |
| rxjs | ⏳ | |
| Bun | ⏳ | ทุก service |
| Drizzle ORM / drizzle-kit | ⏳ | ทุก service |
| Kong | ⏳ (3.x, DB-less) | |
| RabbitMQ | ⏳ | |

## 5. ของใหม่วางที่ไหน

| ของใหม่ | ที่อยู่ |
|---|---|
| โดเมนธุรกิจใหม่ที่มีข้อมูลของตัวเอง | service ใหม่ `st-<domain>-service` + schema ใหม่ (ถามผู้ใช้ก่อน — ห้ามสร้าง service เองเพราะ "แยกให้สวย") |
| หน้าใหม่ในโดเมนที่มีอยู่ | remote ของโดเมนนั้น ไม่สร้าง remote ใหม่ |
| type ที่ใช้ทั้งหน้าบ้านและหลังบ้าน / payload event | `st-contracts` |
| component/pipe/สี ที่ใช้ ≥ 2 remote | `st-shared-ui` |
| config ของ Kong/RabbitMQ/compose | `st-infra` |
| เอกสารที่ใช้ทุก repo | root workspace · เอกสารเฉพาะ repo อยู่ใน repo นั้น |

## 6. ทะเบียนการเปลี่ยนโครงสร้าง

| รหัส | วันที่ | เปลี่ยนอะไร | เหตุผล |
|---|---|---|---|
| STR-001 | 2026-11-23 | สร้าง workspace + เอกสารกลาง + โฟลเดอร์ 11 repo (ว่าง) | เริ่มโปรเจกต์ (TASK-001) |
