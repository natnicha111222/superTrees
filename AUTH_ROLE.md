# AUTH_ROLE.md — login / role / สิทธิ์

สถานะ: **แผน** — งานจริงอยู่ที่ [TASK-003](tasks/TASK-003.md) · วิธีตรวจ JWT รอ [CONF-002](conf/CONF-002.md)

## ตอนนี้ (ก่อน TASK-003)

- ทุก service มี `src/middleware/auth.ts` (`requireAuth`) ที่เส้นต้อง login ผ่าน · env `AUTH_MODE`:
  - `disabled` (ค่าเริ่มต้น) → 503 `AUTH_NOT_CONFIGURED`
  - `dev-fixed-user` → ทุก request เป็น `DEV_USER_ID` role `user` — **[MOCK-002](MOCKS.md)** · `config.ts` ไม่ยอมให้ใช้ถ้า `APP_ENV` ไม่ใช่ `local`
- Kong ยังไม่ตรวจ JWT ([MOCK-006](MOCKS.md)) · ยังไม่มีหน้า login ใน shell
- ทำ TASK-003: เพิ่มโหมดตรวจ JWT จริงใน `requireAuth` แล้วลบ `dev-fixed-user`

## ผู้ออก token

**Supabase Auth** เป็นผู้ออก JWT ที่เดียว · ไม่มี auth-service ของเราเอง · ช่องทาง login ที่จะเปิด ⏳ (ตัวเลือก: อีเมล+รหัสผ่าน, OTP โทรศัพท์, Google, Apple — แอป iOS ที่มี social login อื่นต้องมี Sign in with Apple ด้วย)

## Role

| role | ใคร | ทำอะไรได้ (แผน) |
|---|---|---|
| `user` (ค่าเริ่มต้น) | ผู้ใช้ทั่วไป | ดู/ค้นประกาศ · สร้างแปลง/ประกาศ/สวนของตัวเอง · แก้ได้เฉพาะของตัวเอง |
| `agent` | นายหน้าที่ยืนยันตัวตนแล้ว | เหมือน `user` + ป้าย "นายหน้า" + ⏳ |
| `admin` | ผู้ดูแลระบบ | ตรวจ/ซ่อนประกาศ, ดูเอกสารสิทธิ์เพื่อยืนยัน |

## กฎ

- role อยู่ใน **`app_metadata.role`** เท่านั้น (ตั้งได้จากฝั่ง server/service_role) — **ห้ามอ่าน role จาก `user_metadata`** เพราะผู้ใช้แก้เองได้
- เปลี่ยน role ทำผ่าน endpoint ของ admin ที่หลังบ้าน ไม่ใช่จากแอป
- สิทธิ์รายตัว (เจ้าของแปลง/ประกาศ) ตรวจที่ **service** ด้วย `owner_id = sub` ทุกครั้ง — Kong ตรวจแค่ "login แล้วและ token ถูกต้อง"
- หน้าบ้านซ่อนปุ่มตาม role ได้เพื่อความสะดวก แต่ไม่นับเป็นการกันสิทธิ์
- token หมดอายุ → refresh ผ่าน supabase-js · refresh ไม่ได้ → logout

## คำถามค้าง

- ยืนยันตัวตนนายหน้า/เจ้าของที่ดินด้วยอะไร (บัตรประชาชน? เลขใบอนุญาต?) → กระทบ PDPA
- ต้องมีการเข้าใช้แบบไม่ login (ดูประกาศอย่างเดียว) ไหม → ถ้ามี เส้นค้นหาต้องเปิดสาธารณะที่ Kong และระวังข้อมูลตำแหน่งแปลง ([CODE_STANDARDS.md](CODE_STANDARDS.md) ข้อ privacy)
