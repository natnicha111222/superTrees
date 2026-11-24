# st-mfe-listing

remote (Native Federation) — ประกาศขาย

> สถานะ: 🟡 โครง TASK-002 — หน้า placeholder · หน้าจริงใน 4202:TASK-005

- stack: Ionic 9 + Angular 22.2 (standalone + signals) — เวอร์ชันต้องตรงตารางเวอร์ชันของ workspace
- port (dev):  ค้นหา/กรอง, รายละเอียดประกาศ, สร้าง/แก้ประกาศ (ตั้งใน `angular.json`) · expose: `./routes` → `src/app/exposed/routes.ts` (shell mount ที่ `/listings`)
- ห้าม import remote อื่น · ใช้ของกลางจาก `@supertrees/shared-ui` · รันเดี่ยวได้ (`npm run dev`) — ใช้ `public/config.json` ของตัวเอง

## หน้า / route (ใต้ path ที่ shell mount)
| path | หน้า |
|---|---|
| `''` | HomePage (placeholder) |
