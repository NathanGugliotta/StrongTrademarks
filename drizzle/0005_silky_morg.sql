ALTER TABLE "applications" ADD COLUMN "engagement_letter_version" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "engagement_letter_html" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "engagement_letter_signature" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "engagement_letter_signed_at" timestamp with time zone;