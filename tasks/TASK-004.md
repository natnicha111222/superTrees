# TASK-004 — แปลงที่ดินบนแผนที่: วาด/แก้ polygon + วัดพื้นที่/ระยะ

**สถานะ:** ⏳ · **repo:** st-parcel-service, st-mfe-map, st-contracts

## ขอบเขต
- วาดแปลงบนแผนที่ (แตะทีละจุด / ใช้ GPS เดินรอบแปลง ⏳), แก้จุด, ลบ
- แสดงพื้นที่เป็น ไร่-งาน-ตร.วา + ตร.ม. และเส้นรอบรูป (ค่าที่บันทึกคำนวณที่หลังบ้าน)
- ข้อมูลแปลง: ชื่อ, ประเภทเอกสารสิทธิ์ (master), หมายเหตุ, ไฟล์โฉนด (bucket `title-deeds` — PDPA)
- ไลบรารีแผนที่ + basemap ตัดสินแล้ว: MapLibre GL 6.19.0 + Esri World Imagery (PoC) — [CONF-006](../conf/CONF-006.md) · ดูวิธีโหลด CSS/worker จาก `st-mfe-garden/src/app/components/map-point-picker.component.ts`

## บัคที่เจอ
- ยังไม่มี
