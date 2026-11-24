# st-mfe-map

remote (Native Federation) — แผนที่

> สถานะ: 🟡 โครง TASK-002 — หน้า placeholder · หน้าจริงใน 4201:TASK-004

- stack: Ionic 9 + Angular 22.2 (standalone + signals) — เวอร์ชันต้องตรงตารางเวอร์ชันของ workspace
- port (dev):  แสดง/วาด/แก้แปลง, เครื่องมือวัดพื้นที่-ระยะ, (ภายหลัง) ความชัน/เส้นชั้นความสูง (ตั้งใน `angular.json`) · expose: `./routes` → `src/app/exposed/routes.ts` (shell mount ที่ `/map`)
- ห้าม import remote อื่น · ใช้ของกลางจาก `@supertrees/shared-ui` · รันเดี่ยวได้ (`npm run dev`) — ใช้ `public/config.json` ของตัวเอง

## หน้า / route (ใต้ path ที่ shell mount)
| path | หน้า |
|---|---|
| `''` | HomePage (placeholder) |
