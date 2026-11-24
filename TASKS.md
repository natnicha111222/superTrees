# TASKS.md — ตารางสรุปงาน + เรื่องที่ต้องตัดสินใจ

กติกา: รายละเอียดอยู่ `tasks/TASK-NNN.md` — สถานะในตารางนี้กับในไฟล์ต้องตรงกัน · งานที่แตะหลาย repo ระบุ repo + ลำดับ release ในไฟล์ task · บัคไม่เขียนในไฟล์ task (ลิงก์ไป `bugs/`)

สถานะ: ⏳ ยังไม่เริ่ม · 🚧 กำลังทำ · 🟡 เสร็จแต่ยังไม่ทดสอบ · ✅ เสร็จ · ⛔ ติด CONF · ⏸️ พักไว้ (ผู้ใช้เลื่อน)

## งาน

| รหัส | งาน | repo | สถานะ |
|---|---|---|---|
| [TASK-001](tasks/TASK-001.md) | วาง workspace + เอกสารกลาง + โฟลเดอร์ repo ว่าง | root | ✅ |
| [TASK-002](tasks/TASK-002.md) | โครง hello-world ทุก repo + docker-compose รันได้ครบ | ทุก repo | ✅ |
| [TASK-003](tasks/TASK-003.md) | Login ด้วย Supabase + role + Kong ตรวจ JWT | infra, shell, ทุก service | ⏳ |
| [TASK-004](tasks/TASK-004.md) | แปลงที่ดินบนแผนที่: วาด/แก้ polygon + วัดพื้นที่/ระยะ | parcel-service, mfe-map | ⏳ |
| [TASK-005](tasks/TASK-005.md) | ประกาศขาย + ค้นหา/กรอง + หมุดราคาบนแผนที่ | listing-service, mfe-listing, mfe-map | ⏳ |
| [TASK-006](tasks/TASK-006.md) | ต้นไม้/สวนบนแปลง + ประเมินมูลค่า/คาร์บอน | garden-service, mfe-garden | ⏳ |
| [TASK-007](tasks/TASK-007.md) | ความชัน + เส้นชั้นความสูง | parcel-service, mfe-map | ⛔ CONF-003 |
| [TASK-008](tasks/TASK-008.md) | AI ช่วยเขียนคำบรรยายประกาศ | listing-service, mfe-listing | ⏳ |
| [TASK-009](tasks/TASK-009.md) | แอปมือถือ (Capacitor Android/iOS) | shell (+ build รวม remote) | ⏸️ พักไว้ — ทำเว็บก่อน |
| [TASK-010](tasks/TASK-010.md) | นับต้นไม้ + จัดแถวจากภาพถ่ายมุมสูง (port จาก Colab) | contracts, garden-service, mfe-garden | 🟡 e2e ด้วยภาพจำลองผ่าน · รอภาพโดรนจริง |
| [TASK-011](tasks/TASK-011.md) | วางแผนปลูก: ปักขอบเขตบนแผนที่ + ระยะปลูก → ตำแหน่งต้นไม้ | contracts, garden-service, mfe-garden | 🟡 e2e บน local ผ่าน |
| [TASK-012](tasks/TASK-012.md) | รวมแกนกริด + เทียบแผนกับผลนับ + flow วิเคราะห์→ตรวจ→บันทึก | contracts, garden-service, mfe-garden | 🟡 e2e บน local ผ่าน |

## เรื่องที่ต้องตัดสินใจ / ขัดกัน (CONF)

| รหัส | เรื่อง | สถานะ |
|---|---|---|
| [CONF-001](conf/CONF-001.md) | Native Federation บนแอปมือถือ (Capacitor) โหลด remote จากไหน | ⏸️ เลื่อนไป TASK-009 (ทำเว็บก่อน) |
| [CONF-002](conf/CONF-002.md) | Kong ตรวจ JWT ของ Supabase แบบไหน (HS256 secret / asymmetric JWKS) | ❓ เปิด |
| [CONF-003](conf/CONF-003.md) | แหล่งข้อมูลแปลงที่ดินและความสูง (DEM) | ❓ เปิด |
| [CONF-004](conf/CONF-004.md) | หลังบ้าน Go หรือ Bun | ✅ Bun + Drizzle (2026-11-23) |
| [CONF-005](conf/CONF-005.md) | ภาพนับต้นไม้: มาตราส่วน/ผูกกับแผนที่ + ประมวลผลที่ไหน | ✅ จุดคู่ภาพ↔แผนที่ (+สมมติระยะปลูกเป็นสำรอง) · sync ≤ 4096 px (2026-11-23) |
| [CONF-006](conf/CONF-006.md) | ไลบรารีแผนที่ + แหล่งภาพดาวเทียม | ✅ MapLibre GL + Esri World Imagery (PoC) (2026-11-23) |
