# CONF-004 — หลังบ้าน Go หรือ Bun

**สถานะ:** ✅ ตัดสินใจแล้ว (ผู้ใช้ 2026-11-23)

## ปัญหา
tech stack ระบุ "go/bun" และ ORM = Drizzle — Drizzle ใช้ได้เฉพาะ TypeScript

## ผลการตัดสินใจ
**Bun + Hono + Drizzle ORM** ทุก service · ภาษาเดียวกับหน้าบ้าน แชร์ type ผ่าน `@supertrees/contracts` · ถ้าภายหลังมี service ที่ต้องการ Go (เช่นประมวลผล raster หนัก) ให้เปิด CONF ใหม่
