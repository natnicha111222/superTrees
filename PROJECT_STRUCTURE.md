# PROJECT_STRUCTURE.md — โครงสร้าง superTrees

อ่านก่อนสร้าง repo / โฟลเดอร์ / package / เอกสารใหม่ หรือย้ายไฟล์ · เปลี่ยนโครงเมื่อไรให้เพิ่มแถวในทะเบียน `STR-NNN` ท้ายไฟล์

## 0. การตัดสินใจหลัก (ผู้ใช้กำหนด 2026-11-23 — ห้ามเปลี่ยนเอง)

- **git repo เดียว** (เปลี่ยนจาก multirepo 2026-11-24 · STR-007): root + ทุกโฟลเดอร์ `st-*` อยู่ใน repo `superTrees` · แต่ละ `st-*` ยังเป็นหน่วยอิสระ (package/lockfile/`.gitignore` ของตัวเอง, ไม่ใช้ npm/bun workspaces, ไม่ import ข้ามโฟลเดอร์ — ของร่วมผ่าน tarball ใน `vendor/`)
- **micro frontend ด้วย Native Federation** (`@angular-architects/native-federation`) — shell + remote ต่อโดเมน
- **หลังบ้าน Bun + Hono + Drizzle** (ไม่ใช้ Go — [CONF-004](conf/CONF-004.md))
- **ทำเว็บก่อน** (2026-11-23): ยังไม่ใช้ Capacitor / ไม่มี `android/` `ios/` — มือถือพักไว้ที่ TASK-009
- **Supabase** = Auth + Postgres/PostGIS + Storage · **Kong** = API gateway · **RabbitMQ** = event ข้าม service · **Docker** สำหรับรันทั้งชุด

## 1. แผนผัง workspace

```
D:\superTrees\                  ← git repo "superTrees" (เอกสารกลาง + โค้ดทุกโฟลเดอร์)
├── CLAUDE.md  README.md  PROJECT_STRUCTURE.md  ARCHITECTURE.md
├── AUTH_ROLE.md  API_ROUTES.md  API_ROUTES_HISTORY.md  EVENTS.md
├── TASKS.md  BUGS.md  MOCKS.md  CODE_STANDARDS.md
├── tasks/  conf/  bugs/  security/
│
├── st-infra/                   ← docker-compose, Kong, RabbitMQ, Supabase local config
├── st-contracts/               ← @supertrees/contracts: type DTO + payload ของ event (TS)
├── st-shared-ui/               ← @supertrees/shared-ui: theme, component/pipe กลาง (Angular lib)
├── st-shell/                   ← host: Ionic + Angular (เว็บ · Capacitor ภายหลัง)
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
| `st-infra` | compose + config + สคริปต์รัน dev | Kong 8000 (proxy) · RabbitMQ 5672 / 15672 | — | 🟡 Supabase local + Kong + RabbitMQ + `scripts/dev.mjs` |
| `st-contracts` | TS package | — | — | 🟡 0.5.0 |
| `st-shared-ui` | Angular library | — | — | 🟡 0.1.2 (theme, runtime config + map, pipe) |
| `st-shell` | Ionic host | 4200 | — | 🟡 layout + เมนู + โหลด remote |
| `st-mfe-map` | remote | 4201 | — | 🟡 placeholder |
| `st-mfe-listing` | remote | 4202 | — | 🟡 placeholder |
| `st-mfe-garden` | remote | 4203 | — | 🟡 นับต้นไม้จากภาพ (TASK-010) + วางแผนปลูก (TASK-011) |
| `st-parcel-service` | Bun service | 3001 | schema `parcel` · bucket `title-deeds` | 🟡 health |
| `st-listing-service` | Bun service | 3002 | schema `listing` · bucket `listing-photos` | 🟡 health |
| `st-garden-service` | Bun service | 3003 | schema `garden` · bucket `garden-photos` | 🟡 health + tree-surveys (TASK-010) + planting-plans (TASK-011) |
| `st-notification-service` | Bun service | 3004 | schema `notify` | 🟡 health + consumer (กันซ้ำ) |

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

ทุก repo ที่รันได้ (service, remote, shell) ต้องมี script **`dev`** ใน `package.json` — `st-infra` ใช้รันรวม (`npm run dev:backend` / `dev:frontend`) · service อ่าน port จาก env `PORT` · หน้าบ้านตั้ง port ใน `angular.json` ตามตารางข้อ 2

ของร่วม (`@supertrees/contracts`, `@supertrees/shared-ui`) ติดตั้งจาก **tarball ใน `vendor/` ของแต่ละ repo** (`"file:vendor/<pkg>-<ver>.tgz"`) — สร้างด้วย `npm run pack:vendor` ใน repo ต้นทาง · commit ไฟล์ใน `vendor/` · ห้ามชี้ `file:` ไปโฟลเดอร์/repo อื่น (STR-005)

README ของ service ต้องมีหัวข้อ: หน้าที่ · Endpoints · Schema/ตาราง · Bucket · Event ที่ publish/consume · env var

### Remote (`st-mfe-*`)

```
src/app/
  exposed/routes.ts     ← ของที่ expose ผ่าน federation
  pages/  components/  services/
  app.ts  app.config.ts  app.routes.ts   ← ใช้ตอนรัน remote เดี่ยวเท่านั้น
public/config.json      ← runtime config ตอนรันเดี่ยว
federation.config.mjs   ← expose + share ทุก dependency แบบ singleton strict
vendor/                 ← tarball ของ @supertrees/*
```

expose เป็น **routes** (`./routes`) ให้ shell `loadChildren` — ไม่ expose component ทีละตัว

### Shell (`st-shell`)

```
src/app/
  layout/  auth/ (TASK-003)  core/ (interceptor — TASK-003)
  app.routes.ts         ← loadRemoteModule ต่อ remote (ล้ม → RemoteErrorPage)
public/federation.manifest.json   ← ที่อยู่ remote ต่อ environment
public/config.json      ← runtime config (apiBaseUrl ฯลฯ) อ่านด้วย RuntimeConfigService ของ shared-ui
(capacitor.config.ts  android/  ios/ — ยังไม่สร้าง จนกว่าจะทำ TASK-009)
```

## 4. ตารางเวอร์ชัน (ต้องตรงกันทุก repo หน้าบ้าน)

| library | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Angular (`@angular/*`) | **22.2.7** · `@angular/build` / `@angular/cli` **22.2.8** | ล็อกที่ 22.2 เพราะ native-federation 22.2.5 ต้องการ `@angular/build ~22.2.0` · zoneless (ไม่มี zone.js) |
| TypeScript (หน้าบ้าน) | **6.0.3** | Angular 22.2 ต้องการ `>=6.0 <6.1` |
| Ionic (`@ionic/angular`) / ionicons | **9.0.13** / **8.1.1** | Ionic 9: import component จาก `@ionic/angular` (ไม่มี `/standalone`) |
| Capacitor | — ยังไม่ใช้ (TASK-009) | เฉพาะ shell |
| @angular-architects/native-federation | **22.2.5** | |
| rxjs | **7.8.2** | |
| ng-packagr (shared-ui) | **22.2.6** | builder `@angular/build:ng-packagr` |
| Bun | **1.3.11** | ทุก service |
| hono / zod / drizzle-orm / drizzle-kit / postgres | **4.13.20** / **4.6.7** / **0.45.4** / **0.31.11** / **4.1.1** | ทุก service · TypeScript หลังบ้าน 5.9.3 |
| maplibre-gl | **6.19.0** | ทุก remote ที่มีแผนที่ (ตอนนี้ mfe-garden) — CONF-006 |
| amqplib / sharp / @supabase/storage-js | **2.4.1** / **0.35.5** / **2.119.2** | sharp + storage-js เฉพาะ garden |
| Supabase CLI | **3.2.0** (ผ่าน `npx`) | Postgres 17 · PostGIS 3.3 |
| Kong | **3.9** (DB-less) | |
| RabbitMQ | **4.1** (management-alpine) | |

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
| STR-002 | 2026-11-23 | ตัด Capacitor/`android`/`ios` ออกจากโครง st-shell ระยะแรก | ผู้ใช้ตัดสินใจทำเว็บก่อน (TASK-009 พักไว้) |
| STR-003 | 2026-11-23 | st-garden-service: เพิ่ม `src/services/tree-grid/` (pure TS) + `test/` ก่อนมีโครง TASK-002 | port สคริปต์นับต้นไม้ (TASK-010) — ไม่มี dependency จึงย้ายเข้าโครงได้ตรง ๆ |
| STR-004 | 2026-11-23 | st-infra: `package.json` + `scripts/dev.mjs` (`npm run dev:backend` / `dev:frontend` / `dev`) · ข้อตกลงทุก repo มี script `dev` ฟัง `PORT` | ผู้ใช้ขอสคริปต์รันทุก service พร้อมกัน · วางใน st-infra เพราะ root เป็นเอกสารอย่างเดียว |
| STR-005 | 2026-11-23 | TASK-002: โครงทุก repo (Bun service ×4, Angular app ×4, library, contracts, infra) · ของร่วมแจกด้วย tarball ใน `vendor/` · remote มี `app.*` สำหรับรันเดี่ยว · shell มี `public/config.json` | ผู้ใช้เลือก tarball ใน vendor/ (ไม่ใช้ registry) |
| STR-006 | 2026-11-24 | st-garden-service: `src/services/grid/core.ts` แกนกริดร่วมของนับจากภาพ + วางแผนปลูก · `src/services/planting/compare.ts` · st-mfe-garden: `components/tree-survey-editor-panel.component.ts` (แผงแก้ไขใช้ร่วม 2 หน้า), `pages/plan-compare.page.ts` | ผู้ใช้ขอรวมการคำนวณและเชื่อมสองฟีเจอร์ (TASK-012) |
| STR-007 | 2026-11-24 | รวมเป็น git repo เดียว: ลบ `.git` ใน `st-*` ทั้ง 11 ตัว (ยังไม่มี commit) · เอา `/st-*/` ออกจาก root `.gitignore` · กฎ "ห้าม workspaces / ห้าม import ข้ามโฟลเดอร์ / ของร่วมผ่าน `vendor/`" คงเดิม | ผู้ใช้ต้องการ commit/push ทุกอย่างพร้อมกันครั้งเดียว |
