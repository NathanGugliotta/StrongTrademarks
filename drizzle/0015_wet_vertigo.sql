CREATE TABLE "uspto_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"event_code" text NOT NULL,
	"event_description" text NOT NULL,
	"event_date" date NOT NULL,
	"milestone_key" text,
	"raw" jsonb,
	"polled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "last_tsdr_polled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "tsdr_current_status" text;--> statement-breakpoint
ALTER TABLE "uspto_status_events" ADD CONSTRAINT "uspto_status_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uspto_status_events_app_code_date_idx" ON "uspto_status_events" USING btree ("application_id","event_code","event_date");