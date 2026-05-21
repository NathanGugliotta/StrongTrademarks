CREATE TABLE "signature_request_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signature_request_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"token" text NOT NULL,
	"signature" text,
	"signed_at" timestamp with time zone,
	"signed_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_request_signers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"template_key" text,
	"title" text NOT NULL,
	"body_text" text,
	"source_file_url" text,
	"source_file_name" text,
	"source_file_mime_type" text,
	"version" text NOT NULL,
	"target_subfolder_path" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"drive_pdf_file_id" text,
	"drive_pdf_url" text,
	"requested_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "signature_request_id" uuid;--> statement-breakpoint
ALTER TABLE "signature_request_signers" ADD CONSTRAINT "signature_request_signers_signature_request_id_signature_requests_id_fk" FOREIGN KEY ("signature_request_id") REFERENCES "public"."signature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;