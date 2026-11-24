CREATE TABLE "garden"."planting_plan_trees" (
	"plan_id" uuid NOT NULL,
	"tree_no" integer NOT NULL,
	"row_no" integer NOT NULL,
	"col_no" integer NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	CONSTRAINT "planting_plan_trees_plan_id_tree_no_pk" PRIMARY KEY("plan_id","tree_no")
);
--> statement-breakpoint
ALTER TABLE "garden"."planting_plan_trees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "garden"."planting_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"boundary" jsonb NOT NULL,
	"geom" geometry(Polygon, 4326) NOT NULL,
	"spacing_m" numeric(8, 3) NOT NULL,
	"angle_deg" numeric(9, 4) NOT NULL,
	"utm_epsg" integer NOT NULL,
	"area_sqm" numeric(14, 2) NOT NULL,
	"tree_count" integer NOT NULL,
	"row_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden"."planting_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "garden"."planting_plan_trees" ADD CONSTRAINT "planting_plan_trees_plan_id_planting_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "garden"."planting_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planting_plan_trees_geom_gist" ON "garden"."planting_plan_trees" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "planting_plans_owner_parcel_idx" ON "garden"."planting_plans" USING btree ("owner_id","parcel_id","created_at");--> statement-breakpoint
CREATE INDEX "planting_plans_geom_gist" ON "garden"."planting_plans" USING gist ("geom");