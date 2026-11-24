# CONF-006 — ไลบรารีแผนที่หน้าบ้าน + แหล่งภาพดาวเทียม

**สถานะ:** ✅ ตัดสินใจแล้ว (ผู้ใช้ 2026-11-23) · **กระทบ:** TASK-010 (ปักจุดอ้างอิง), TASK-004 (mfe-map), TASK-005 (หมุดราคา)

## ปัญหา
ต้องมีแผนที่ให้ปักจุดอ้างอิงภาพ↔แผนที่ (CONF-005) และใช้ต่อใน mfe-map · การปักจุดต้องเห็น**ภาพดาวเทียม** เพื่อหาจุดเดียวกับภาพโดรน · แหล่ง tile แต่ละเจ้าเงื่อนไขไลเซนส์ต่างกัน

## ทางเลือกที่พิจารณา
| | ไลบรารี | หมายเหตุ |
|---|---|---|
| ✅ | **MapLibre GL** | BSD-3 · WebGL · vector tile, หมุดจำนวนมาก, polygon — เหมาะกับ TASK-004/005 |
| | Leaflet | BSD-2 · เล็ก ง่าย · raster เป็นหลัก |

| | ภาพดาวเทียม | หมายเหตุ |
|---|---|---|
| ✅ (PoC) | **Esri World Imagery** | ไม่ต้องมี key · ต้องแสดง attribution · ใช้เชิงพาณิชย์/production ต้องมีบัญชี ArcGIS Location Platform (ตรวจเงื่อนไขก่อนขึ้นจริง) → MOCK-007 |
| | MapTiler Satellite | ต้องมี key (free tier) |
| | GISTDA Sphere | ผู้ให้บริการไทย · ต้องมี key · API ไม่ใช่ tile มาตรฐาน |

## ผลการตัดสินใจ
- **MapLibre GL 6.19.0** ทุก remote ที่มีแผนที่ (เวอร์ชันเดียวกัน — share singleton ผ่าน federation)
- **Esri World Imagery** + ชั้นชื่อสถานที่ (Reference/World_Boundaries_and_Places) สำหรับ PoC — **URL อยู่ใน runtime config** (`config.json` → `map`) เปลี่ยนผู้ให้บริการได้โดยไม่ build ใหม่ · attribution แสดงเสมอ
- ก่อนขึ้น production: เลือกแหล่งที่มีสัญญา/บัญชี (ปิด MOCK-007)
- หมายเหตุ (2026-11-23): Esri ในพื้นที่ชนบทของไทยไม่มีภาพระดับซูม 19 — ส่งรูป "Map data not yet available" (HTTP 200) มาแทน จึงตั้ง `maxZoom: 18` ใน config ให้ MapLibre ขยายภาพระดับ 18 แทน
