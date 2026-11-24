# TASK-003 — Login ด้วย Supabase + role + Kong ตรวจ JWT

**สถานะ:** ⏳ · **repo:** st-infra, st-shell, ทุก service · รายละเอียด role ที่ [AUTH_ROLE.md](../AUTH_ROLE.md)

## ขอบเขต
- shell: หน้า login/สมัคร, เก็บ session (เว็บ: storage ของ `supabase-js` · secure storage มือถือไปทำใน TASK-009), interceptor แนบ token เฉพาะ `/api/`, guard
- Supabase: ตั้ง `app_metadata.role` ค่าเริ่มต้น `user` (auth hook หรือ trigger ⏳)
- Kong: ตรวจ JWT ตาม CONF-002, ทิ้ง `X-User-*` ที่ client ส่ง
- service: middleware ตรวจ JWT ซ้ำ → `c.get('user')`

## ต้องตัดสินใจก่อน
- CONF-002 · ช่องทาง login (AUTH_ROLE.md)

## บัคที่เจอ
- ยังไม่มี
