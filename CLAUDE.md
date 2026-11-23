# CLAUDE.md — superTrees

ไฟล์นี้ให้คำแนะนำแก่ Claude Code เมื่อทำงานใน workspace นี้ — เก็บเฉพาะ**กฎ**และ**แผนที่ว่ารายละเอียดอยู่ไฟล์ไหน** ของใหม่ที่เป็นรายละเอียดให้เขียนในเอกสารเฉพาะทาง แล้วใส่แค่กฎ/ลิงก์ที่นี่

## ภาพรวม

**superTrees (PoC)** = แอปมือถือ + เว็บ สำหรับ**ซื้อ-ขาย/วิเคราะห์ที่ดินบนแผนที่** (แปลงเป็น polygon, หมุดราคา, วัดพื้นที่/เส้นรอบรูป/ความชัน/เส้นชั้นความสูง, กรองตามราคา/ขนาด/ประเภทเอกสารสิทธิ์) **+ จัดการต้นไม้/สวนบนแปลง** (ปลูกอะไร ตรงไหน กี่ต้น อายุเท่าไร ประเมินมูลค่า/คาร์บอน)

แนวคิดคล้ายแอปตลาดที่ดินในไทยที่มีอยู่แล้ว แต่**ชื่อ แบรนด์ ข้อความ ภาพ ไอคอน เป็นของเราเองทั้งหมด ห้ามลอกของแอปอื่น**

## ⚠️ ข้อมูลลับ/sensitive data ห้ามอ่านเอง (กฎตายตัว)

**ห้ามเปิดอ่าน/เขียนค่าจริงของ** Supabase `service_role`/secret key, JWT secret/signing key, รหัส DB, รหัส RabbitMQ, API key (AI, แผนที่) ไม่ว่าจะอยู่ใน `.env`, `supabase/.env`, `kong.yml` ที่ใส่ค่าจริง หรือที่ใดก็ตาม — ช่วยได้แค่บอกว่าต้องใส่ที่ไฟล์ไหน ตัวแปรอะไร รูปแบบไหน แล้วให้ผู้ใช้กรอกเอง · ไฟล์ตัวอย่างใช้ `CHANGE_ME` เสมอ

`anon`/publishable key ฝังในแอปได้ (เป็นค่าสาธารณะโดยออกแบบ) แต่ตารางที่เข้าถึงด้วย key นี้ได้ต้องเปิด RLS เสมอ

## ⚠️ โครงสร้าง DB เปลี่ยนผ่าน migration เท่านั้น (กฎตายตัว)

- เปลี่ยน schema = ไฟล์ migration ของ Drizzle (`drizzle-kit generate`) **ใน repo ของ service เจ้าของ schema เท่านั้น** · ห้ามแก้ตารางผ่าน Supabase Studio · ห้าม `drizzle-kit push` กับ DB ที่ใช้ร่วมกัน (dev กลาง/uat/prod) · ห้ามแก้ไฟล์ migration ที่ apply ไปแล้ว ให้เขียนตัวใหม่
- migration ที่ทำข้อมูลหาย (`DROP`, `RENAME`, เปลี่ยน type, `NOT NULL` กับคอลัมน์ที่มีข้อมูล) **ต้องให้ผู้ใช้ยืนยันก่อน** และห้าม apply เองกับ DB ที่ไม่ใช่ local
- schema `auth`/`storage`/`realtime` ของ Supabase ห้ามแก้ ห้ามสร้างตารางเพิ่มในนั้น

## 📝 อัปเดตเอกสารทุกครั้งที่แก้โค้ด (กฎตายตัว)

**แก้โค้ด/config เมื่อไร ต้องอัปเดตเอกสารที่เกี่ยวข้องในงานเดียวกันเสมอ** ตอนสรุปงานให้บอกผู้ใช้ว่าอัปเดตเอกสารไหนบ้าง (หรือบอกว่าไม่ต้องอัปเดตเพราะอะไร)

| เปลี่ยนอะไร | ต้องอัปเดต |
|---|---|
| เพิ่ม/ลบ/เปลี่ยนเส้น API หรือ route ของ Kong | [API_ROUTES.md](API_ROUTES.md) · เปลี่ยนชื่อ/ลบเส้นเดิม → [API_ROUTES_HISTORY.md](API_ROUTES_HISTORY.md) · README ของ service (หัวข้อ Endpoints) · `st-infra/kong/kong.yml` |
| event RabbitMQ (exchange, routing key, payload, consumer) | [EVENTS.md](EVENTS.md) · type ใน `st-contracts` |
| schema/ตาราง/คอลัมน์/index/bucket | README ของ service (หัวข้อ Schema) · ไฟล์ task ที่เกี่ยว |
| login / role / claim / RLS | [AUTH_ROLE.md](AUTH_ROLE.md) |
| UI กลาง / สี / component ใน shared-ui | `st-shared-ui/README.md` + `st-shared-ui/THEME.md` |
| หน้า/route ของ shell หรือ remote | README ของ repo นั้น + ตาราง remote ใน [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) |
| repo/โฟลเดอร์/package/เอกสารใหม่ หรือย้ายไฟล์ · เวอร์ชัน library หลัก | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) (+ แถว `STR-NNN`) |
| สถาปัตยกรรม (flow, port, การเชื่อมต่อ) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| env var / docker-compose / วิธีรัน | `st-infra/README.md` · `.env.example` ของ repo นั้น · [README.md](README.md) |
| ความคืบหน้างาน | [TASKS.md](TASKS.md) + `tasks/TASK-NNN.md` (สถานะสองที่ต้องตรงกัน) |
| บัค · ช่องโหว่ · เรื่องที่ต้องตัดสินใจ/ขัดกัน | `bugs/BUG-NNN.md` + [BUGS.md](BUGS.md) · `security/SEC-NNN.md` + [CODE_STANDARDS.md](CODE_STANDARDS.md) · `conf/CONF-NNN.md` + ตาราง CONF ใน TASKS.md |
| mock / ข้อมูลจำลอง / บัญชีทดสอบ / ทางลัดชั่วคราว | [MOCKS.md](MOCKS.md) (แถว `MOCK-NNN` + ใส่รหัสใน comment ที่โค้ด) |
| กฎใหม่ที่ทุกคนต้องรู้ | สรุป 1–2 บรรทัดที่ CLAUDE.md + รายละเอียดในเอกสารเฉพาะทาง |

## แผนที่เอกสาร

| เรื่อง | ไฟล์ |
|---|---|
| 🗂️ โครงสร้าง workspace, รายชื่อ repo, โครงภายใน repo, ตารางเวอร์ชัน, ทะเบียน `STR-NNN` — **อ่านก่อนสร้าง repo/โฟลเดอร์/package ใหม่** | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) |
| 🏗️ สถาปัตยกรรม: flow ของ request/login/ไฟล์/event, port, ความเป็นเจ้าของ schema | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 🔐 login, role, claim ใน JWT, RLS | [AUTH_ROLE.md](AUTH_ROLE.md) |
| 📌 ทะเบียนเส้น API + route ของ Kong + หน้าบ้านที่เรียก | [API_ROUTES.md](API_ROUTES.md) + [API_ROUTES_HISTORY.md](API_ROUTES_HISTORY.md) |
| 📨 ทะเบียน event RabbitMQ | [EVENTS.md](EVENTS.md) |
| 📋 งาน + เรื่องที่ต้องตัดสินใจ (CONF) | [TASKS.md](TASKS.md) + [`tasks/`](tasks/) + [`conf/`](conf/) |
| 🐞 สมุดบัค — **ก่อนไล่บัคให้ค้นใน `bugs/` ก่อน** | [BUGS.md](BUGS.md) + [`bugs/`](bugs/) |
| 🛡️ มาตรฐานโค้ด + checklist ความปลอดภัย + ทะเบียน `SEC-NNN` — **อ่านก่อนเขียน/review โค้ดเรื่องสิทธิ์, input, ไฟล์, ตำแหน่งที่ตั้ง** | [CODE_STANDARDS.md](CODE_STANDARDS.md) + [`security/`](security/) |
| 🧪 ของจำลอง/ทางลัดที่ต้องกลับมาทำจริง | [MOCKS.md](MOCKS.md) |
| ⚙️ ภาพรวม, เครื่องมือที่ต้องติดตั้ง, วิธีรัน | [README.md](README.md) · `st-infra/README.md` |

## Multirepo

- `D:\superTrees` = repo **workspace** (เอกสารกลางเท่านั้น ไม่มีโค้ด) · โฟลเดอร์ `st-*` แต่ละตัวเป็น **git repo แยก** (root `.gitignore` ignore ไว้)
- **ห้ามทำเป็น monorepo/workspaces** (npm/bun/nx workspaces) และห้าม import ข้าม repo ด้วย path สัมพัทธ์ (`../st-xxx`) — ของร่วมใช้ผ่าน package ที่มีเวอร์ชัน (`@supertrees/contracts`, `@supertrees/shared-ui`) ติดตั้งด้วย tarball หรือ private registry **ห้าม `file:`/symlink** (Angular DI แตกเป็น 2 ชุด → `NG0203`)
- งานที่แก้หลาย repo: ระบุ repo + ลำดับ release ในไฟล์ task (contracts → services → shared-ui → remotes → shell) · contract เปลี่ยนแบบ breaking = major version
- commit แยกตาม repo · commit/push เฉพาะเมื่อผู้ใช้สั่ง

## สถาปัตยกรรม (ย่อ — ละเอียดที่ [ARCHITECTURE.md](ARCHITECTURE.md))

- request: แอป → **Kong** → service · Kong ตรวจ JWT ของ Supabase, ทิ้ง header `X-User-*` ที่ client ส่งมาเอง, ทำ CORS/rate limit · **service ต้องตรวจ JWT เองด้วยเสมอ** (ห้ามเชื่อ Kong อย่างเดียว) · ห้าม publish port ของ service ออกนอก docker network
- หน้าบ้านคุยกับ Supabase ตรงได้**เฉพาะ Auth** (login/refresh/logout) และอัปโหลด/ดาวน์โหลดไฟล์ด้วย **signed URL ที่ service ออกให้** — ข้อมูลธุรกิจผ่าน Kong → service เท่านั้น
- Postgres ของ Supabase ตัวเดียว แต่**แต่ละ service เป็นเจ้าของ schema ของตัวเอง** (`parcel`/`listing`/`garden`/`notify`) + DB role ของตัวเอง · **ห้าม query/join schema ของ service อื่น** · id ข้าม service เก็บเป็น `uuid` ธรรมดา ไม่มี FK ข้าม schema · ต้องการข้อมูลให้เรียก API ภายใน หรือเก็บสำเนาจาก event
- ข้าม service: อ่านแบบ sync = HTTP ภายใน docker network (ไม่ผ่าน Kong) · แจ้งการเปลี่ยนแปลง = **event RabbitMQ** ตาม [EVENTS.md](EVENTS.md) · consumer ต้อง idempotent (กันซ้ำด้วย `eventId`) · publish หลัง commit เท่านั้น
- Storage: **bucket เป็น private ทั้งหมด** · DB เก็บ **object path ไม่ใช่ URL** (signed URL หมดอายุ) · service ตรวจสิทธิ์ + ชนิด/ขนาดไฟล์ก่อนออก signed URL · โฉนด/เอกสารสิทธิ์ = ข้อมูลส่วนบุคคล (PDPA) แยก bucket เห็นได้เฉพาะเจ้าของ + admin

## หลังบ้าน (Bun)

- **Bun + Hono + Drizzle ORM + zod** · ทุก service โครงเหมือนกัน (ละเอียดที่ [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)):
  - `routes/` รับ/ส่ง DTO, validate ด้วย zod, เรียก service — ไม่เรียก repository ตรง ไม่คืนแถว DB ดิบ
  - `services/` **logic ทั้งหมด** (เงื่อนไข, คำนวณ, ตรวจสิทธิ์/ความเป็นเจ้าของ, transaction, โยน error, publish event)
  - `repositories/` แค่ query ด้วย Drizzle แล้วคืนข้อมูล — ไม่มี `if` ตัดสินใจ ไม่โยน HTTP error
- SQL: ใช้ query builder ของ Drizzle · `` sql`...` `` ใช้ได้เฉพาะฟังก์ชัน PostGIS/query ซับซ้อน โดยค่าต้องเป็น parameter (`${value}`) เสมอ — **ห้าม `sql.raw()` กับค่าจากผู้ใช้ ห้ามต่อ string**
- รายการแบ่งหน้าคืน `{ items, page, size, totalItems }` · error คืน `{ code, message, details? }` รูปแบบเดียวทุก service
- ข้อมูลที่แย่งกันแก้ (สถานะประกาศ, จอง) ใช้ `SELECT ... FOR UPDATE` ใน transaction หรือ conditional update ที่เช็คสถานะเดิม

## ภูมิศาสตร์ / หน่วย / เงิน / วันที่ (กฎตายตัว)

- geometry เก็บ **SRID 4326** (`geometry(MultiPolygon|Point, 4326)`) + index **GIST** · คำนวณพื้นที่/ระยะด้วย `::geography` หรือ transform เป็น UTM (EPSG:32647/32648) — **ห้ามคำนวณพื้นที่จากค่าองศาตรง ๆ** · validate polygon (`ST_IsValid`) ก่อนบันทึก
- GeoJSON เข้า/ออก API เรียงพิกัด **`[lng, lat]`** เสมอ · ค้นหาบนแผนที่ใช้ bbox (`&&` + `ST_MakeEnvelope`) + จำกัดจำนวนผล
- เก็บพื้นที่เป็น **ตร.ม.**, ระยะเป็น **เมตร**, ราคาเป็น **`numeric`/จำนวนเต็มสตางค์** (ห้าม float) · **ไร่-งาน-ตร.วา** (1 ไร่ = 1,600 ตร.ม. · 1 งาน = 400 ตร.ม. · 1 ตร.วา = 4 ตร.ม.) **มีแค่ตอนแสดงผล/รับค่า** ผ่าน pipe/ฟังก์ชันกลางใน shared-ui
- เวลาเก็บ `timestamptz` รับ/ส่งเป็น ISO-8601 UTC (`...Z`) · **พ.ศ./เวลาไทยมีแค่ตอนแสดงผล** ผ่าน pipe กลาง ห้าม `+ 543` เองในหน้า

## หน้าบ้าน (Ionic + Angular + Capacitor + Native Federation)

- **Angular 21+ standalone + signals**, Ionic standalone components, Capacitor · `st-shell` = host (layout, tabs/menu, login, routing, โหลด remote) · `st-mfe-*` = remote 1 ตัวต่อโดเมน
- **เวอร์ชัน Angular / Ionic / `@angular-architects/native-federation` / rxjs / `@supertrees/shared-ui` ต้องตรงกันทุก repo หน้าบ้าน** และ share เป็น singleton (strict) — อัปเกรดต้องทำพร้อมกันทุก repo ตามตารางเวอร์ชันใน [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **remote ห้าม import ของกันและกัน** · ข้อมูลข้าม remote ผ่าน route param หรือ service กลางใน shared-ui · remote ไม่ทำ login เอง ใช้ session จาก shell
- ใช้ component ของ Ionic + ของกลางใน shared-ui ห้ามเขียนซ้ำในหน้า · **ห้ามใส่รหัสสีเอง** ใช้ token ใน `st-shared-ui/THEME.md` · ไอคอนใช้ ionicons
- การโหลดที่ยิงซ้ำได้ (ค้นหา, เลื่อน/ซูมแผนที่) ต้อง**ยกเลิก request ที่ค้างก่อนยิงใหม่** (`switchMap`/`rxResource`) + debounce การเลื่อนแผนที่
- base URL ของ API มาจาก environment/runtime config (บนมือถือไม่มี dev proxy) ห้าม hardcode host ในโค้ด
- ก่อนทำ build มือถือที่ใช้ federation อ่าน [CONF-001](conf/CONF-001.md)

## สถานะ (อย่าสันนิษฐานว่ามีของจริงแล้ว)

- 2026-11-23: วางเอกสาร + โฟลเดอร์ repo ว่าง (TASK-001) — **ยังไม่มีโค้ดใน repo ใดเลย** · ขั้นต่อไป TASK-002 (โครง hello-world ทุก repo)
