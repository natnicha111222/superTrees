# CODE_STANDARDS.md — มาตรฐานโค้ด + ความปลอดภัย

อ้างอิง: OWASP Top 10, OWASP API Security Top 10, OWASP MASVS (แอปมือถือ), PDPA · ช่องโหว่ที่เจอบันทึก `security/SEC-NNN.md` + ตารางท้ายไฟล์

## Checklist ตอนเขียน/review

### สิทธิ์ (สำคัญที่สุด — API1 BOLA)
1. ทุกเส้นที่รับ id (`/parcels/{id}`, `/listings/{id}`) ตรวจ `owner_id = userId` หรือ role ที่ service **ทุกครั้ง** — query แบบ `WHERE id = $1 AND owner_id = $2` ไม่ใช่ดึงมาแล้วลืมเช็ค
2. service ตรวจ JWT เองเสมอ ไม่เชื่อ header ที่มาจาก Kong อย่างเดียว · role อ่านจาก `app_metadata` เท่านั้น
3. owner_id มาจาก token เสมอ **ห้ามรับจาก body/query**
4. ห้ามแก้ฟิลด์ที่ผู้ใช้ไม่ควรแก้ (mass assignment) — zod schema ของ request ระบุฟิลด์ที่รับชัดเจน (`.strict()`)

### Input
5. validate ทุก request ด้วย zod (ชนิด, ช่วง, ความยาว) · GeoJSON: จำกัดจำนวนจุด, ตรวจ `ST_IsValid`, พิกัดอยู่ในช่วงที่สมเหตุสมผล
6. bbox ค้นหาจำกัดขนาดกรอบ + จำกัดจำนวนผล (กันดูดข้อมูลทั้งประเทศ)
7. SQL ผ่าน Drizzle / parameter เท่านั้น — ห้าม `sql.raw()` กับค่าจากผู้ใช้
8. ข้อความที่ผู้ใช้พิมพ์ (คำบรรยายประกาศ) แสดงผลแบบ text · ถ้าต้องแสดง HTML ต้องผ่าน sanitizer

### ไฟล์
9. bucket private · service ตรวจชนิด (allowlist นามสกุล + MIME + magic bytes ถ้าทำได้) และขนาดก่อนออก signed URL · object path สร้างโดย service (ไม่ใช้ชื่อไฟล์จากผู้ใช้) · signed URL อายุสั้น
10. ลบรูป/ข้อมูลตำแหน่ง (EXIF GPS) ออกจากรูปประกาศก่อนเผยแพร่ ⏳

### ข้อมูลส่วนบุคคล / ตำแหน่ง (PDPA)
11. โฉนด/เอกสารสิทธิ์, เบอร์โทร, ชื่อเจ้าของ = ข้อมูลส่วนบุคคล — ไม่ใส่ใน log, event payload, หรือ response ที่คนอื่นเห็น
12. ตำแหน่งแปลงของผู้ใช้ที่ยังไม่ประกาศขาย = ส่วนตัว ห้ามโผล่ในค้นหาสาธารณะ
13. ขอ consent ก่อนเก็บตำแหน่ง GPS ของอุปกรณ์ + อธิบายเหตุผลใน permission prompt

### ค่าลับ / config
14. ค่าลับมาจาก env เท่านั้น ห้าม hardcode ห้าม commit `.env` · `service_role` key ห้ามอยู่ในแอป/หน้าบ้านเด็ดขาด
15. ห้าม publish port ของ service/DB/RabbitMQ management ออกนอกเครื่องตอน deploy · CORS ตั้งที่ Kong แบบ allowlist origin

### มือถือ (ใช้เมื่อเริ่ม TASK-009 — ระยะนี้ทำเว็บอย่างเดียว)
16. token เก็บใน secure storage ของอุปกรณ์ ไม่ใช่ localStorage บนมือถือ · บังคับ https · ไม่ log token

### ทั่วไป
17. หน้าบ้าน: ยกเลิก request ค้างก่อนยิงใหม่ · ไม่ใส่สีเอง · ใช้ของกลาง
18. error response ไม่ส่ง stack trace/ข้อความ SQL ออกไป
19. dependency ใหม่: ตรวจว่ามีคนดูแล + ไลเซนส์ใช้ได้ (โดยเฉพาะไลบรารีแผนที่/ข้อมูลแผนที่)

## ทะเบียนช่องโหว่

| รหัส | เรื่อง | ระดับ | repo | สถานะ |
|---|---|---|---|---|
| | | | | |
