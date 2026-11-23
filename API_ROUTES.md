# API_ROUTES.md — ทะเบียนเส้น API + route ของ Kong

กฎ:
- ตั้งชื่อเส้นตาม**โดเมนธุรกิจ** ไม่ผูกชื่อ service (ย้ายโดเมนไป service อื่น = แก้แค่ upstream ใน Kong)
- prefix `/api/v1/` · resource เป็นพหูพจน์ kebab-case · GeoJSON `[lng, lat]`
- เพิ่ม/แก้เส้น = อัปเดตไฟล์นี้ + `st-infra/kong/kong.yml` + README ของ service · เปลี่ยนชื่อ/ลบ = เพิ่มแถวใน [API_ROUTES_HISTORY.md](API_ROUTES_HISTORY.md)

สถานะ: ⏳ แผน · 🟡 มีโค้ดแต่ยังไม่ทดสอบ · ✅ ใช้งานได้

## Route ของ Kong

| path prefix | upstream | ต้อง login | หมายเหตุ |
|---|---|---|---|
| `/api/v1/parcels` | st-parcel-service:3001 | ✅ | |
| `/api/v1/listings` | st-listing-service:3002 | ⏳ (ค้นหาอาจเปิดสาธารณะ — AUTH_ROLE คำถามค้าง) | |
| `/api/v1/gardens`, `/api/v1/tree-species` | st-garden-service:3003 | ✅ | |
| `/api/v1/notifications` | st-notification-service:3004 | ✅ | |

## เส้น API

| method | path | service | หน้าที่ | หน้าบ้านที่เรียก | สถานะ |
|---|---|---|---|---|---|
| GET | `/api/v1/parcels?bbox=` | parcel | แปลงของฉันในกรอบแผนที่ | mfe-map | ⏳ |
| POST | `/api/v1/parcels` | parcel | สร้างแปลง (GeoJSON) → คืนพื้นที่/เส้นรอบรูป | mfe-map | ⏳ |
| GET/PUT/DELETE | `/api/v1/parcels/{id}` | parcel | ดู/แก้/ลบแปลงของฉัน | mfe-map | ⏳ |
| POST | `/api/v1/parcels/measure` | parcel | วัดพื้นที่/ระยะของ geometry โดยไม่บันทึก | mfe-map | ⏳ |
| GET | `/api/v1/listings/search?bbox=&priceMin=&priceMax=&areaMin=&areaMax=&deedType=` | listing | ค้นหาประกาศ + หมุดราคา | mfe-listing, mfe-map | ⏳ |
| POST | `/api/v1/listings` | listing | สร้างประกาศจากแปลงของฉัน | mfe-listing | ⏳ |
| GET/PUT | `/api/v1/listings/{id}` | listing | ดู/แก้ประกาศ | mfe-listing | ⏳ |
| GET/POST | `/api/v1/gardens/{parcelId}/plantings` | garden | รายการ/เพิ่มการปลูกบนแปลง | mfe-garden | ⏳ |
| GET | `/api/v1/tree-species` | garden | master ชนิดพันธุ์ไม้ | mfe-garden | ⏳ |
