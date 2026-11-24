ALTER TABLE "garden"."tree_surveys" ADD COLUMN "assumed_spacing_m" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "garden"."tree_surveys" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
-- เติมค่าย้อนหลัง: ตอนสร้าง meters_per_pixel = ระยะปลูก / medianSpacingPx จึงคูณกลับได้ระยะปลูกเดิม
UPDATE "garden"."tree_surveys" SET "assumed_spacing_m" = round("meters_per_pixel" * ("stats"->>'medianSpacingPx')::numeric, 3) WHERE "scale_source" = 'assumedSpacing' AND "assumed_spacing_m" IS NULL;
