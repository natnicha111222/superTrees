# st-mfe-garden

remote (Native Federation) — ต้นไม้/สวนบนแปลง · **นับต้นไม้จากภาพมุมสูง** (TASK-010/012), **วางแผนปลูก** (TASK-011) และ **เทียบแผนกับผลนับ** (TASK-012) — สลับด้วยแท็บ (`components/garden-tabs.component.ts`)

> สถานะ: 🟡 TASK-010 หน้าจอครบ — ทดสอบ end-to-end ในเบราว์เซอร์กับหลังบ้านจริงผ่าน (ภาพจำลอง)

- stack: Ionic 9 + Angular 22.2 (standalone + signals, zoneless) · port (dev): 4203 · expose `./routes` (shell mount ที่ `/garden`)
- ห้าม import remote อื่น · ของกลางจาก `@supertrees/shared-ui` · DTO จาก `@supertrees/contracts`

## หน้า / route (ใต้ `/garden`)
| path | หน้า | API |
|---|---|---|
| `''` | redirect → แปลงทดลอง (MOCK-003 — `demoParcelId` ใน runtime config) | |
| `parcels/:parcelId/tree-surveys` | รายการผลการนับ | `GET .../tree-surveys` |
| `parcels/:parcelId/tree-surveys/new` | **ขั้น 1** เลือกภาพ → ปักขอบเขต → มาตราส่วน → "วิเคราะห์ภาพ" (ไม่บันทึก) · **ขั้น 2** ตรวจ/แก้ผล (แผงเดียวกับหน้าผล) → ตั้งชื่อ → "บันทึกผลการนับ" | `POST .../upload-url` → PUT ไป Storage → `POST .../analyze` → `POST .../preview` (ร่าง) → `POST .../tree-surveys` + `result` |
| `parcels/:parcelId/compare?plan=&survey=` | เทียบแผนปลูกกับผลนับที่ผูกแผนที่: สถิติ, แผนที่ (หลุมมีต้น/ว่าง/ต้นนอกแผน + เส้นเชื่อม), รายการ (คลิก ↔ แผนที่) · ระยะจับคู่ปรับได้ | `GET .../planting-plans/{id}/compare` (rxResource) |
| `parcels/:parcelId/planting-plans` | รายการแผนปลูก | `GET .../planting-plans` |
| `parcels/:parcelId/planting-plans/new` | ปักมุมแปลงบนแผนที่ + ระยะปลูก → พรีวิวอัตโนมัติ → บันทึก / CSV | `POST .../planting-plans/preview` (debounce + switchMap) → `POST .../planting-plans` |
| `parcels/:parcelId/planting-plans/:planId` | แผนที่ขอบเขต + จุดต้นไม้ + ตาราง (คลิกจุด ↔ เลื่อน/ไฮไลต์แถว, คลิกแถว ↔ บินไปที่ต้น) + CSV · **โหมดแก้ไข**: ตรวจสอบ/เพิ่ม/ลบหมุด, เลื่อนกริดทีละ 0.5 ม., หมุน ±0.5°, ระยะปลูก, เติมจุดตามตาราง, รีเซ็ต, ลบทั้งหมด, ชื่อ → บันทึก | `GET .../planting-plans/{id}` · แก้ไข: `POST .../preview` (debounce 200 ms + switchMap) → `PUT .../planting-plans/{id}` |
| `parcels/:parcelId/tree-surveys/:surveyId` | ผล: สถิติ + ภาพ/จุด/กริด + ตาราง (ซิงก์กัน) + CSV · **โหมดแก้ไข** | `GET .../tree-surveys/{id}` · แก้ไข: `POST .../{id}/preview` (debounce 150 ms + switchMap) → `PUT .../{id}` |

## ส่วนสำคัญ
- `components/survey-canvas.component.ts` — SVG ในพิกัดพิกเซลของภาพจริง: ซูม/เลื่อน, คลิกได้พิกัดถูกแม้ภาพถูกย่อ (`getScreenCTM`), hit-test ต้นไม้ด้วย JS (รองรับหลายพันต้น) · สีจาก `--st-viz-*`
- `services/maplibre.ts` — ตั้งค่า MapLibre ร่วมกัน: โหลดไลบรารี + CSS + worker จาก asset ของ remote, style ภาพดาวเทียมจาก runtime config, สีจาก token, GPS เมื่อกดเท่านั้น
- `components/planting-map.component.ts` — แผนที่วางแผนปลูก: `pickPoints` (ปักมุม/เพิ่มหมุด) หรือคลิกต้นไม้ → `treeClick`, ขอบเขต/มุม/ต้นไม้/กริดเป็น GeoJSON layer (รองรับหลายพันจุด), ไฮไลต์ต้นที่เลือก + `focus()`, หมุดเพิ่มเองสีต่าง, ซูมพอดีแปลง
- `services/planting-plan-editor.ts` — สถานะโหมดแก้ไขแผนปลูก (ต่อหน้า): เก็บแค่ มุม/ระยะ/เลื่อน/removed/extras · ผลทุกอย่างมาจากหลังบ้าน
- `components/map-point-picker.component.ts` — เลือกพิกัดจุดอ้างอิงบนแผนที่ดาวเทียม (MapLibre GL 6.19.0, CONF-006) ใน modal ของหน้านับใหม่ · แหล่ง tile จาก `config.json` → `map` · โหลดไลบรารีเมื่อเปิดเท่านั้น · CSS/worker เป็น asset ของ remote (`angular.json` assets) อ้างด้วย `import.meta.url` + `setWorkerUrl`
- `components/tree-survey-editor-panel.component.ts` — แผงแก้ผลการนับ ใช้ทั้งหน้าผลและขั้นตรวจผลของหน้าวิเคราะห์ใหม่ (ช่องอื่นใส่ผ่าน `<ng-content>`)
- `services/tree-survey-editor.ts` — สถานะโหมดแก้ไข (ต่อหน้า): โหมดคลิก ตรวจสอบ/เพิ่ม/ลบ · เลื่อนกริดตามแนวกริดทีละ 2 px · หมุน ±0.5° รอบกลางขอบเขต · คำนวณระยะช่องใหม่ · รีเซ็ตกริด · เติมจุดตามตาราง · ลบทั้งหมด (ถามยืนยัน) · บันทึก/ยกเลิก (ถามยืนยันถ้าแก้แล้ว) — หน้าบ้านเก็บแค่จุด + ค่ากริด ผลทุกอย่างมาจากหลังบ้าน
- `services/image-prep.ts` — ย่อภาพให้ด้านยาว ≤ 4096 px ก่อนอัปโหลด (CONF-005) · `parseLatLngText()` รับ "ละติจูด, ลองจิจูด" → `[lng, lat]`
- `services/tree-survey-api.service.ts` — base URL จาก `RuntimeConfigService` · อัปโหลดด้วย signed URL (PUT ตรงไป Supabase Storage)
- ระยะแบบ "ระยะปลูก" ติดป้าย **ประมาณ** ทุกที่ (MOCK-001)

## ยังไม่ทำ
- ลากจุดต้นไม้เพื่อย้ายตำแหน่ง (ตอนนี้ลบแล้วเพิ่มใหม่) · เตือนก่อนออกจากหน้าถ้ายังไม่บันทึก
