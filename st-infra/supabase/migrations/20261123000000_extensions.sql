-- st-infra: ส่วนกลางของฐานข้อมูลที่ไม่ใช่ของ service ใด (ตาราง/สคีมาธุรกิจอยู่ใน migration ของ service เจ้าของ)
-- PostGIS: geometry SRID 4326 + GIST (CLAUDE.md)
create extension if not exists postgis with schema extensions;
