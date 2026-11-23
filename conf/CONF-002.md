# CONF-002 — Kong ตรวจ JWT ของ Supabase แบบไหน

**สถานะ:** ❓ เปิด · **กระทบ:** TASK-003, st-infra, middleware ของทุก service · **ผู้ตัดสินใจ:** ผู้ใช้

## ปัญหา
Supabase ออก JWT ได้ 2 แบบ: **legacy shared secret (HS256)** และ **signing key แบบ asymmetric** (ES256/RS256 มี JWKS ที่ `<supabase-url>/auth/v1/.well-known/jwks.json`) · plugin `jwt` ของ Kong OSS ตรวจด้วย key ที่ตั้งไว้ใน credential แบบคงที่ ไม่ดึง JWKS เอง (plugin OpenID Connect ที่ดึง JWKS ได้เป็นของ Kong Enterprise) — ตรวจกับเอกสารเวอร์ชันที่ใช้จริงอีกครั้งตอนทำ

## ทางเลือก
| | วิธี | ข้อดี | ข้อเสีย |
|---|---|---|---|
| A | HS256 secret ใส่ใน Kong + ทุก service | ง่ายที่สุด | secret เดียวกระจายหลายที่ รั่วที่เดียว = ปลอม token ได้ |
| B | asymmetric: ใส่ **public key** ใน Kong (`jwt` plugin) · service ตรวจด้วย JWKS (`jose`) | ไม่มีความลับใน Kong/service | หมุนกุญแจต้องอัปเดต config Kong |
| C | Kong ไม่ตรวจ ปล่อย service ตรวจเอง | config น้อย | ขัดกฎ "Kong กรองชั้นแรก" |

## ข้อเสนอ
**B**

## ผลการตัดสินใจ
- ยังไม่ตัดสินใจ
