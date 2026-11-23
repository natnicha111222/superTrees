# TASKS.md — ตารางสรุปงาน + เรื่องที่ต้องตัดสินใจ

กติกา: รายละเอียดอยู่ `tasks/TASK-NNN.md` — สถานะในตารางนี้กับในไฟล์ต้องตรงกัน · งานที่แตะหลาย repo ระบุ repo + ลำดับ release ในไฟล์ task · บัคไม่เขียนในไฟล์ task (ลิงก์ไป `bugs/`)

สถานะ: ⏳ ยังไม่เริ่ม · 🚧 กำลังทำ · 🟡 เสร็จแต่ยังไม่ทดสอบ · ✅ เสร็จ · ⛔ ติด CONF

## งาน

| รหัส | งาน | repo | สถานะ |
|---|---|---|---|
| [TASK-001](tasks/TASK-001.md) | วาง workspace + เอกสารกลาง + โฟลเดอร์ repo ว่าง | root | ✅ |
| [TASK-002](tasks/TASK-002.md) | โครง hello-world ทุก repo + docker-compose รันได้ครบ | ทุก repo | ⏳ |
| [TASK-003](tasks/TASK-003.md) | Login ด้วย Supabase + role + Kong ตรวจ JWT | infra, shell, ทุก service | ⏳ |
| [TASK-004](tasks/TASK-004.md) | แปลงที่ดินบนแผนที่: วาด/แก้ polygon + วัดพื้นที่/ระยะ | parcel-service, mfe-map | ⏳ |
| [TASK-005](tasks/TASK-005.md) | ประกาศขาย + ค้นหา/กรอง + หมุดราคาบนแผนที่ | listing-service, mfe-listing, mfe-map | ⏳ |
| [TASK-006](tasks/TASK-006.md) | ต้นไม้/สวนบนแปลง + ประเมินมูลค่า/คาร์บอน | garden-service, mfe-garden | ⏳ |
| [TASK-007](tasks/TASK-007.md) | ความชัน + เส้นชั้นความสูง | parcel-service, mfe-map | ⛔ CONF-003 |
| [TASK-008](tasks/TASK-008.md) | AI ช่วยเขียนคำบรรยายประกาศ | listing-service, mfe-listing | ⏳ |

## เรื่องที่ต้องตัดสินใจ / ขัดกัน (CONF)

| รหัส | เรื่อง | สถานะ |
|---|---|---|
| [CONF-001](conf/CONF-001.md) | Native Federation บนแอปมือถือ (Capacitor) โหลด remote จากไหน | ❓ เปิด |
| [CONF-002](conf/CONF-002.md) | Kong ตรวจ JWT ของ Supabase แบบไหน (HS256 secret / asymmetric JWKS) | ❓ เปิด |
| [CONF-003](conf/CONF-003.md) | แหล่งข้อมูลแปลงที่ดินและความสูง (DEM) | ❓ เปิด |
| [CONF-004](conf/CONF-004.md) | หลังบ้าน Go หรือ Bun | ✅ Bun + Drizzle (2026-11-23) |
