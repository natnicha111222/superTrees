# EVENTS.md — ทะเบียน event RabbitMQ

## กติกา

- exchange เดียว **`supertrees.events`** ชนิด `topic` (durable) · แต่ละ consumer มี queue ของตัวเอง `<service>.<เรื่อง>` + dead-letter queue `<queue>.dlq`
- routing key = `<domain>.<entity>.<กริยาอดีต>` เช่น `parcel.parcel.created`
- payload ทุกตัวห่อด้วย envelope เดียวกัน (type อยู่ใน `@supertrees/contracts`):

```json
{
  "eventId": "uuid v7",
  "type": "parcel.parcel.created",
  "version": 1,
  "occurredAt": "2026-11-23T08:00:00Z",
  "producer": "st-parcel-service",
  "data": { }
}
```

- **publish หลัง commit เท่านั้น** · consumer ต้อง **idempotent** (เก็บ `eventId` ที่ประมวลผลแล้ว) · ล้มเหลวซ้ำ → DLQ ไม่วนไม่จบ
- เปลี่ยน payload แบบ breaking = เพิ่ม `version` + รองรับทั้งสองเวอร์ชันช่วงเปลี่ยนผ่าน
- ห้ามใส่ข้อมูลส่วนบุคคลเกินจำเป็นใน payload (event อยู่ในคิว/log นาน)
- ⏳ outbox pattern: ตอน PoC publish ตรงหลัง commit (อาจหายถ้า service ล่มระหว่างนั้น) — [MOCK-005](MOCKS.md)
- ทำแล้ว (TASK-002): publisher ใช้ confirm channel + `persistent` + `messageId = eventId` · notification ใช้ queue `notification.events` → DLQ `notification.events.dlq` ผ่าน exchange `supertrees.events.dlx` (direct) · กันซ้ำด้วยตาราง `notify.processed_events`

## ทะเบียน

สถานะ: ⏳ แผน · 🟡 มีโค้ด · ✅ ใช้งานได้

| routing key | producer | consumer | data (ย่อ) | สถานะ |
|---|---|---|---|---|
| `parcel.parcel.created` / `.updated` | parcel | listing (อัปเดต `parcel_snapshots`), garden | `parcelId, ownerId, areaSqm, centroid, deedType` | ⏳ |
| `parcel.parcel.deleted` | parcel | listing (ปิดประกาศ), garden | `parcelId` | ⏳ |
| `listing.listing.published` | listing | notification | `listingId, parcelId, price` | ⏳ |
| `listing.listing.sold` | listing | notification | `listingId` | ⏳ |
| `garden.planting.added` | garden | notification | `plantingId, parcelId, speciesCode, count` | ⏳ |
| `garden.tree-survey.completed` | garden | notification (log) | `surveyId, parcelId, treeCount` — TASK-010 | 🟡 |
| `garden.planting-plan.created` | garden | — (ยังไม่มี consumer) | `planId, parcelId, treeCount` — บันทึกแผนปลูก (TASK-011) | 🟡 |
| `garden.planting-plan.updated` | garden | — (ยังไม่มี consumer) | `planId, parcelId, treeCount` — แก้ไขแผนปลูกแล้วบันทึก (TASK-011) | 🟡 |
| `garden.tree-survey.updated` | garden | — (ยังไม่มี consumer) | `surveyId, parcelId, treeCount` — ผู้ใช้แก้จุด/กริดแล้วบันทึก (TASK-010) | 🟡 |
| `system.service.started` | ทุก service (ตอนเริ่ม) | notification (log) | `service` — ทดสอบเส้นทาง event (TASK-002) | 🟡 |
