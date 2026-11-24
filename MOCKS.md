# MOCKS.md — ของจำลอง / ทางลัดที่ต้องกลับมาทำจริง

อ่านก่อนสันนิษฐานว่าส่วนไหนใช้ของจริงแล้ว และก่อนขึ้น uat/prod

กติกา: เพิ่ม mock / ข้อมูลจำลอง / บัญชีทดสอบ / หน้า placeholder / ค่าที่รอตัดสินใจ = เพิ่มแถว `MOCK-NNN` + ใส่ comment `// MOCK-NNN` ที่โค้ด · ทำของจริงแล้ว = เปลี่ยนสถานะเป็น ✅ เลิกแล้ว (ไม่ลบแถว)

| รหัส | อะไร | repo / ไฟล์ | ของจริงคือ | สถานะ |
|---|---|---|---|---|
| MOCK-001 | มาตราส่วนแบบ `assumedSpacing`: สมมติระยะปลูกแล้วคิด m/px ย้อนกลับ (ทางลัดจากสคริปต์ Colab — ระยะที่ได้ไม่ใช่ค่าวัด) | st-garden-service `src/services/tree-grid/grid.ts` | ผูกภาพกับแผนที่ด้วยจุดคู่ (`scale.kind = 'georef'`) — ทำแล้วในโมดูล · CONF-005 ให้เก็บแบบนี้ไว้เป็น**ค่าสำรอง**เมื่อผู้ใช้ไม่ปักจุด โดยผลมี `scaleIsEstimate: true` และหน้าจอต้องติดป้าย "ประมาณ" | ⏳ ใช้อยู่ (สำรอง) |
| MOCK-002 | `AUTH_MODE=dev-fixed-user`: ทุก request เป็นผู้ใช้ `DEV_USER_ID` (config บังคับใช้ได้เฉพาะ `APP_ENV=local`) · ค่าเริ่มต้นคือ `disabled` = 503 | ทุก service `src/middleware/auth.ts`, `src/config.ts` | ตรวจ JWT ของ Supabase ตาม CONF-002 (TASK-003) | ⏳ ใช้อยู่ (local) |
| MOCK-003 | แปลงทดลอง `demoParcelId` ใน runtime config + garden-service ไม่ตรวจว่าแปลงมีจริง/เป็นของผู้ใช้ (ข้อมูลยังกรองด้วย owner_id) | st-shell / st-mfe-garden `public/config.json`, `exposed/routes.ts` · st-garden-service `tree-survey.service.ts` + `planting-plan.service.ts` (`assertParcelAccess`) | แปลงจริงจาก parcel-service (TASK-004) + ถาม parcel-service ผ่าน HTTP ภายใน | ⏳ ใช้อยู่ |
| MOCK-004 | service ต่อ DB ด้วย user `postgres` ตอน local | `.env` ของทุก service | DB role ต่อ service ที่มีสิทธิ์แค่ schema ตัวเอง | ⏳ ใช้อยู่ (local) |
| MOCK-005 | publish event ตรงหลัง commit (ไม่มี outbox) — อาจหายถ้า service ล่มระหว่างนั้น · RabbitMQ ล่ม = log แล้วไปต่อ | ทุก service `src/events/publisher.ts` | outbox pattern | ⏳ ใช้อยู่ |
| MOCK-006 | Kong ยังไม่ตรวจ JWT | st-infra `kong/kong.yml` | plugin ตรวจ JWT ตาม CONF-002 | ⏳ ใช้อยู่ |
| MOCK-007 | ภาพดาวเทียม Esri World Imagery ใช้แบบไม่มีบัญชี/key (PoC) | st-shell / st-mfe-garden `public/config.json` (`map`) | แหล่ง tile ที่มีสัญญา/บัญชีสำหรับ production (CONF-006) — เปลี่ยนแค่ config | ⏳ ใช้อยู่ |
