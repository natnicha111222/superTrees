# TASK-009 — แอปมือถือ (Capacitor Android/iOS)

**สถานะ:** ⏸️ พักไว้ — ผู้ใช้ตัดสินใจทำเว็บก่อน (2026-11-23) · **repo:** st-shell (+ ขั้น build รวม dist ของ remote) · st-infra (CORS origin ของแอป)

## ขอบเขต (เมื่อเริ่ม)
- ตัดสินใจ [CONF-001](../conf/CONF-001.md) ก่อน (โหลด remote จากไหนบนมือถือ)
- เพิ่ม Capacitor ใน st-shell + `capacitor.config.ts`, `android/`, `ios/` · กรอกเวอร์ชันใน PROJECT_STRUCTURE.md
- เก็บ session ด้วย secure storage ของอุปกรณ์ (CODE_STANDARDS ข้อ 16) แทน storage ของเบราว์เซอร์
- GPS/กล้องผ่าน plugin ของ Capacitor + consent (CODE_STANDARDS ข้อ 13) · push notification (notification-service)
- runtime config ของ API base URL สำหรับมือถือ (ไม่มี dev proxy)
- ช่องทาง login: แอป iOS ที่มี social login ต้องมี Sign in with Apple (AUTH_ROLE.md)

## บัคที่เจอ
- ยังไม่มี
