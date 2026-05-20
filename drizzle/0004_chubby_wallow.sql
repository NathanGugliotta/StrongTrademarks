ALTER TABLE "applications" ADD COLUMN "docket_number" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_docket_number_unique" UNIQUE("docket_number");