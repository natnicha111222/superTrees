# st-shell

host ของแอป — Ionic 9 + Angular 22.2 (standalone + signals, zoneless) + Native Federation (dynamic host) · **ระยะนี้เว็บอย่างเดียว** (มือถือ = TASK-009)

> สถานะ: 🟡 โครง TASK-002 — layout + เมนู + โหลด remote · login (TASK-003) ยังไม่มี

- port (dev): 4200 (ตั้งใน `angular.json`) · รันรวม: `cd ../st-infra && npm run dev:frontend`
- `public/config.json` = runtime config (`apiBaseUrl` = Kong, `demoParcelId` = MOCK-003, `map` = แหล่ง tile ภาพดาวเทียม Esri — MOCK-007/CONF-006) · โหลดตอนเริ่มด้วย `RuntimeConfigService`
- `public/federation.manifest.json` = ที่อยู่ `remoteEntry.json` ของแต่ละ remote (แก้ต่อ environment ตอน deploy)
- provider ของทั้งแอป (`app.config.ts`): Ionic, HttpClient (fetch), router, runtime config — remote ใช้ร่วม
- remote โหลดไม่ได้ → หน้า `RemoteErrorPage` (ไม่พังทั้งแอป) · path ไม่มี → `NotFoundPage`
- ⏳ TASK-003: หน้า login, session Supabase Auth, interceptor แนบ token เฉพาะ `/api/`, guard

## Route → remote
| path | remote | expose |
|---|---|---|
| `/` | → `/garden` | |
| `/map` | st-mfe-map | `./routes` |
| `/listings` | st-mfe-listing | `./routes` |
| `/garden` | st-mfe-garden | `./routes` |

## คำสั่ง
`npm install` · `npm run dev` · `npm run build` · Ionic 9: import component จาก `@ionic/angular` (ไม่มี `/standalone` แล้ว)
