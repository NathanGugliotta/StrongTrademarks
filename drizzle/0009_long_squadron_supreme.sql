CREATE TYPE "public"."deadline_kind" AS ENUM('office_action', 'statement_of_use', 'section_8', 'section_9', 'ttab', 'other');--> statement-breakpoint
CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "deadline_kind" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by_id" text,
	"reminded_14_at" timestamp with time zone,
	"reminded_7_at" timestamp with time zone,
	"reminded_1_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;