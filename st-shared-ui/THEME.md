# THEME.md — token ของ superTrees

ไฟล์จริง: `projects/shared-ui/styles/theme.css` · ใช้ผ่าน `var(--st-*)` หรือ `color="primary|secondary|success|warning|danger|medium|light"` ของ Ionic — **ห้ามใส่รหัสสีในหน้า/component** (ถ้าต้องการสีใหม่ เพิ่ม token ที่นี่ก่อน + ขึ้นเวอร์ชัน shared-ui)

## สีแบรนด์ / UI
| token | ค่า | ใช้กับ |
|---|---|---|
| `--st-color-primary` (+ `-contrast`, `-shade`, `-tint`) | #2f7d4f เขียวใบไม้ | toolbar, ปุ่มหลัก, ไฮไลต์เมนู — ผูกกับ `--ion-color-primary` |
| `--st-color-secondary` (+ ชุด) | #8a6a3f น้ำตาลดิน | ปุ่มรอง — `--ion-color-secondary` |
| `--st-color-success` / `-warning` / `-danger` | #2e8540 / #c98a00 / #c62828 | สถานะ — ผูกกับ Ionic |
| `--st-color-text` / `-text-muted` | #1c2a21 / #5b6b61 | ข้อความ / ข้อความรอง |
| `--st-color-surface` / `-surface-alt` / `-border` | #fff / #f3f6f2 / #d5ddd6 | พื้น, กล่องสถิติ, เส้นขอบ |

## ภาพวิเคราะห์ / แผนที่ (`--st-viz-*`) — ต้องเห็นชัดบนภาพถ่ายทางอากาศ
| token | ใช้กับ |
|---|---|
| `--st-viz-tree` / `-tree-selected` / `-tree-stroke` | จุดต้นไม้ / ต้นที่เลือก / ขอบจุด |
| `--st-viz-label` / `-label-bg` | เลขต้น / เงาตัวอักษร |
| `--st-viz-grid-row` / `-grid-col` | เส้นกริดแนวแถว / แนวคอลัมน์ |
| `--st-viz-boundary` | ขอบเขตแปลงที่ผู้ใช้ปัก |
| `--st-viz-control-point` | จุดอ้างอิงภาพ↔แผนที่ |
| `--st-viz-canvas-bg` | พื้นหลังกรอบภาพ |

## ระยะ / มุม / ฟอนต์
`--st-space-1..6` (4, 8, 12, 16, 24 px) · `--st-radius` 8px · `--st-font-family` (Sarabun → Noto Sans Thai → system) ผูกกับ `--ion-font-family`
