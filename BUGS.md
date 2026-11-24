# BUGS.md — สมุดบัค

กติกา:
- **ก่อนไล่บัคให้ค้นใน `bugs/` ก่อน** (อาการซ้ำ/คล้าย)
- 1 บัค = `bugs/BUG-NNN.md` (อาการ · วิธีทำให้เกิด · สาเหตุจริง · วิธีแก้ · ไฟล์/repo ที่แก้ · วิธีกันไม่ให้เกิดซ้ำ) + 1 แถวในตารางนี้
- บัคไม่เขียนในไฟล์ task — ไฟล์ task แค่ลิงก์ที่หัวข้อ "บัคที่เจอ"
- บัคที่สอนกฎใหม่ → สรุปกฎที่ CLAUDE.md / CODE_STANDARDS.md

| รหัส | อาการ (ย่อ) | repo | สถานะ |
|---|---|---|---|
| [BUG-001](bugs/BUG-001.md) | `drizzle-kit migrate` ล้ม: schema already exists | service ×4 | ✅ |
| [BUG-002](bugs/BUG-002.md) | คอลัมน์ geometry ที่ drizzle สร้างไม่มี SRID 4326 | st-garden-service | ✅ |
