ALTER TABLE "messages" ADD COLUMN "kind" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_client_secret" text;