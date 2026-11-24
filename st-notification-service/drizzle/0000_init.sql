-- IF NOT EXISTS: drizzle-kit migrate สร้าง schema นี้ก่อนเพื่อเก็บ __drizzle_migrations (migrations.schema ใน drizzle.config.ts)
CREATE SCHEMA IF NOT EXISTS "notify";
--> statement-breakpoint
CREATE TABLE "notify"."processed_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notify"."processed_events" ENABLE ROW LEVEL SECURITY;