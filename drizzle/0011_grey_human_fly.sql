ALTER TYPE "public"."file_kind" ADD VALUE 'filing_receipt' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'office_action' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'office_action_response' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'registration_certificate' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'correspondence' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "uploaded_by_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "uploaded_by_role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;