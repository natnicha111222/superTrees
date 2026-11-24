-- IF NOT EXISTS: drizzle-kit migrate สร้าง schema นี้ก่อนเพื่อเก็บ __drizzle_migrations (migrations.schema ใน drizzle.config.ts)
CREATE SCHEMA IF NOT EXISTS "garden";
--> statement-breakpoint
CREATE TABLE "garden"."tree_survey_trees" (
	"survey_id" uuid NOT NULL,
	"tree_no" integer NOT NULL,
	"row_no" integer NOT NULL,
	"col_no" integer NOT NULL,
	"pixel_x" integer NOT NULL,
	"pixel_y" integer NOT NULL,
	"nearest_tree_no" integer NOT NULL,
	"nearest_distance_px" real NOT NULL,
	"nearest_distance_m" real,
	"geom" geometry(Point, 4326),
	CONSTRAINT "tree_survey_trees_survey_id_tree_no_pk" PRIMARY KEY("survey_id","tree_no")
);
--> statement-breakpoint
ALTER TABLE "garden"."tree_survey_trees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "garden"."tree_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"image_width" integer NOT NULL,
	"image_height" integer NOT NULL,
	"boundary_px" jsonb NOT NULL,
	"control_points" jsonb,
	"scale_source" text NOT NULL,
	"scale_is_estimate" boolean NOT NULL,
	"meters_per_pixel" numeric(12, 6),
	"georef_rms_error_m" numeric(10, 2),
	"utm_epsg" integer,
	"tree_count" integer NOT NULL,
	"stats" jsonb NOT NULL,
	"grid_lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden"."tree_surveys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "garden"."tree_survey_trees" ADD CONSTRAINT "tree_survey_trees_survey_id_tree_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "garden"."tree_surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tree_survey_trees_geom_gist" ON "garden"."tree_survey_trees" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "tree_surveys_owner_parcel_idx" ON "garden"."tree_surveys" USING btree ("owner_id","parcel_id","created_at");