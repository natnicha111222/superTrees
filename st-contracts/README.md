# st-contracts — `@supertrees/contracts`

TypeScript package ที่ใช้ร่วมกันทั้งหน้าบ้านและหลังบ้าน (type + ค่าคงที่เท่านั้น ไม่มี dependency)

> สถานะ: 🟡 0.5.0 (0.5.0 เพิ่ม `TreeSurveyAnalysisDto`, `TreeSurveyDraftPreviewRequest`, `name`/`result` ในการบันทึกผลนับ, `PlanComparisonDto`) · ก่อนหน้า 0.4.0 (0.4.0 เพิ่มการแก้ไขแผนปลูก: `offsetM`/`removed`/`extras`, `gridLines`, `manual`, `updatedAt`, `PlantingPlanUpdateRequest`, event `garden.planting-plan.updated` · 0.3.0 DTO วางแผนปลูก) · ก่อนหน้า 0.2.0 (TASK-002 + TASK-010 · 0.2.0 เพิ่ม DTO แก้ไขผลการนับ: `GridParamsDto`, `TreeSurveyEditRequest`/`PreviewRequest`/`PreviewDto`, `stats.grid`/`edited`, `updatedAt`, event `garden.tree-survey.updated`)

| ไฟล์ | เนื้อหา |
|---|---|
| `src/common.ts` | `ApiError`, `Page<T>`, `HealthResponse`, `LngLat` (`[lng, lat]`) |
| `src/events.ts` | `EVENTS_EXCHANGE`, `EventEnvelope<T>`, `ROUTING_KEYS`, payload ของ event (ตาม EVENTS.md ของ workspace) |
| `src/garden/tree-survey.ts` | DTO + ค่าคงที่ของการนับต้นไม้จากภาพ (TASK-010) |
| `src/garden/planting-plan.ts` | DTO ของวางแผนปลูก (TASK-011) |

- รหัส master ห้ามอยู่ที่นี่ (มาจาก DB)
- semver: breaking change = major · เพิ่มแบบไม่ breaking = minor · **แก้แล้วต้องขึ้นเวอร์ชันใน `package.json` ทุกครั้ง** — pack ซ้ำเวอร์ชันเดิม bun จะใช้ตัวเก่าจาก cache/lock (เจอแล้ว 2026-11-23: ต้อง `bun remove` + `bun add` ใหม่)

## แจกจ่าย (tarball ใน `vendor/` — STR-005)

```bash
npm install
npm run pack:vendor              # build → npm pack → copy .tgz ไป vendor/ ของทุก repo ที่ใช้ package นี้
# หรือระบุ repo: npm run build && node scripts/pack-vendor.mjs st-garden-service st-mfe-garden
```
แล้วใน repo ปลายทาง: `bun install` (service) / `npm install` (หน้าบ้าน) · ถ้าขึ้นเวอร์ชัน แก้ path ใน `package.json` ของ repo นั้นด้วย (`file:vendor/supertrees-contracts-<ver>.tgz`) · ลำดับ release: contracts → services → shared-ui → remotes → shell
