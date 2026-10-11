CREATE TABLE "authorized_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"added_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD CONSTRAINT "authorized_emails_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Grandfather existing accounts, including administrators. New signups use the pending default.
UPDATE users SET access_status = 'approved', email_verified_at = COALESCE(email_verified_at, now());
