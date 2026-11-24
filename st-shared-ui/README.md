# st-shared-ui — `@supertrees/shared-ui`

Angular library ที่ใช้ร่วมกันระหว่าง shell และทุก remote — share เป็น singleton ผ่าน Native Federation

> สถานะ: 🟡 0.1.2 (TASK-002 · 0.1.2 เพิ่ม `map` ใน runtime config — CONF-006)

| ของ | ใช้ยังไง |
|---|---|
| `styles/theme.css` | token สี/ระยะ/ฟอนต์ + ผูกกับสีของ Ionic → รายละเอียด [THEME.md](THEME.md) · ใส่ใน `angular.json` ทุก app |
| `RuntimeConfigService` / `StRuntimeConfig` / `StMapConfig` | shell โหลด `config.json` ตอนเริ่ม · `apiUrl('/api/v1/...')` ได้ URL เต็มผ่าน Kong (ไม่ hardcode host) · `map.satellite`/`map.labels` = แหล่ง tile + attribution, `map.initialCenter` `[lng, lat]` |
| `apiErrorMessage(err)` / `apiErrorCode(err)` | ข้อความ error ภาษาไทยจาก `{ code, message }` ของ service · error ของ gateway (502/503/504/429/เครือข่าย) แปลงเป็นข้อความกลาง |
| `stThaiDate` pipe / `formatThaiDate()` | วันที่ พ.ศ. เวลาไทย — ห้าม `+ 543` เอง |
| `stRaiNganWa` pipe / `sqmToRaiNganWa()` / `raiNganWaToSqm()` | ตร.ม. ↔ ไร่-งาน-ตร.วา (แสดงผล/รับค่าเท่านั้น) |
| `stDistance` pipe | เมตร → "4.0 ม." / "1.35 กม." |

- ห้ามผูก service ของแอปใด (input/output เท่านั้น) · ไม่มี state ของโดเมน · ของที่ใส่ต้องใช้ ≥ 2 remote
- Angular 22.2 ใช้ builder `@angular/build:ng-packagr` (builder `library` ใหม่มีตั้งแต่ 22.3)

## build / test / แจกจ่าย (tarball ใน `vendor/` — STR-005)

```bash
npm install
npm test                 # vitest
npm run pack:vendor      # build (partial compilation) → npm pack → copy ไป vendor/ ของ shell + remote ที่ใช้
```
แล้วใน repo ปลายทาง: `npm install @supertrees/shared-ui@file:vendor/supertrees-shared-ui-<ver>.tgz` · **แก้แล้วขึ้นเวอร์ชันใน `projects/shared-ui/package.json` เสมอ** และติดตั้งเวอร์ชันเดียวกันทุก repo หน้าบ้าน (singleton strict)
