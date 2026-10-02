CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" DROP CONSTRAINT "materials_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "subject_name" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_excerpt" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_verify_user" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Preserve historical content before introducing required columns.
UPDATE attempt_answers a SET snapshot = jsonb_build_object('statement', q.statement, 'options', q.options, 'correctKey', q.correct_key, 'feedback', q.feedback) FROM questions q WHERE q.id = a.question_id;
WITH ordered AS (SELECT id, row_number() OVER (PARTITION BY attempt_id ORDER BY id) - 1 AS position FROM attempt_answers)
UPDATE attempt_answers a SET position = ordered.position FROM ordered WHERE a.id = ordered.id;
UPDATE attempts a SET subject_name = s.name, submission_id = gen_random_uuid() FROM subjects s WHERE s.id = a.subject_id;
ALTER TABLE attempt_answers ALTER COLUMN snapshot SET NOT NULL;
ALTER TABLE attempt_answers ALTER COLUMN position SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN subject_name SET NOT NULL;
ALTER TABLE attempts ALTER COLUMN submission_id SET NOT NULL;
-- Migrate opaque session tokens to SHA-256 hashes without exposing them.
UPDATE sessions SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex');
-- Existing administrators retain access; students must confirm email ownership.
UPDATE users SET email_verified_at = now() WHERE id IN (SELECT user_id FROM admins);
-- Consolidate legacy duplicate progress, retaining counters and earliest due date.
WITH grouped AS (
 SELECT user_id, question_id, min(id::text)::uuid AS keep_id, sum(repetitions)::int AS repetitions,
 sum(correct_count)::int AS correct_count, sum(wrong_count)::int AS wrong_count,
 min(due_at) AS due_at, max(interval_days) AS interval_days, max(last_reviewed_at) AS last_reviewed_at
 FROM study_progress GROUP BY user_id, question_id HAVING count(*) > 1
)
UPDATE study_progress p SET repetitions = g.repetitions, correct_count = g.correct_count, wrong_count = g.wrong_count,
 due_at = g.due_at, interval_days = g.interval_days, last_reviewed_at = g.last_reviewed_at FROM grouped g WHERE p.id = g.keep_id;
DELETE FROM study_progress p USING study_progress kept WHERE p.user_id = kept.user_id AND p.question_id = kept.question_id AND p.id::text > kept.id::text;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_answers_position" ON "attempt_answers" USING btree ("attempt_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_attempts_submission" ON "attempts" USING btree ("user_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_questions_fingerprint" ON "questions" USING btree ("subject_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_study_progress_unique" ON "study_progress" USING btree ("user_id","question_id");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_counts_check" CHECK ("attempts"."total" > 0 and "attempts"."correct_count" >= 0 and "attempts"."correct_count" <= "attempts"."total" and "attempts"."duration_sec" >= 0);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_check" CHECK ("questions"."source" in ('revisao', 'material'));--> statement-breakpoint
ALTER TABLE "study_progress" ADD CONSTRAINT "study_counts_check" CHECK ("study_progress"."interval_days" >= 0 and "study_progress"."repetitions" >= 0 and "study_progress"."correct_count" >= 0 and "study_progress"."wrong_count" >= 0);