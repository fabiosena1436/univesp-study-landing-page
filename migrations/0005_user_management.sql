CREATE TABLE "announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reads_announcement_id_user_id_pk" PRIMARY KEY("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid,
	"recipient_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_quotas" (
	"key" text NOT NULL,
	"period" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tutor_quotas_key_period_pk" PRIMARY KEY("key","period"),
	CONSTRAINT "tutor_quota_nonnegative" CHECK ("tutor_quotas"."requests" >= 0 and "tutor_quotas"."tokens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "user_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "admin_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activity_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_announcements_recipient" ON "announcements" USING btree ("recipient_id","created_at");