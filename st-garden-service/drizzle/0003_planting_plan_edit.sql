ALTER TABLE "garden"."planting_plan_trees" ADD COLUMN "manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ADD COLUMN "offset_x_m" numeric(9, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ADD COLUMN "offset_y_m" numeric(9, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ADD COLUMN "removed" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ADD COLUMN "extras" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ADD COLUMN "updated_at" timestamp with time zone;