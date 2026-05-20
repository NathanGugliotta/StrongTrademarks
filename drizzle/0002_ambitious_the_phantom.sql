ALTER TABLE "applications" ADD COLUMN "first_use_in_commerce_date" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "first_use_anywhere_date" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "declaration_version" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "declaration_signature" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "declaration_signed_at" timestamp with time zone;