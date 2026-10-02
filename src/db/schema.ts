import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  course: text("course"),
  passwordHash: text("password_hash").notNull(),
  isBlocked: boolean("is_blocked").notNull().default(false),
  lastLoginAt: timestamp("last_login_at"),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_password_reset_user").on(t.userId), index("idx_password_reset_hash").on(t.tokenHash)],
);

export const admins = pgTable(
  "admins",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_tickets_user").on(t.userId), index("idx_tickets_status").on(t.status)],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_ticket_messages").on(t.ticketId, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_sessions_token").on(t.token)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#FFD43B"),
    description: text("description"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_subjects_user").on(t.userId)],
);

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    filename: text("filename").notNull(),
    content: text("content").notNull(),
    pageCount: integer("page_count").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_materials_user").on(t.userId),
    index("idx_materials_subject").on(t.subjectId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    materialId: uuid("material_id").references(() => materials.id, {
      onDelete: "cascade",
    }),
    source: text("source").notNull().default("revisao"),
    statement: text("statement").notNull(),
    options: jsonb("options").$type<{ key: string; text: string }[]>().notNull(),
    correctKey: text("correct_key"),
    feedback: text("feedback"),
    sourceExcerpt: text("source_excerpt"),
    fingerprint: text("fingerprint"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_questions_user").on(t.userId),
    index("idx_questions_subject").on(t.subjectId),
    index("idx_questions_material").on(t.materialId),
    uniqueIndex("idx_questions_fingerprint").on(t.subjectId, t.fingerprint),
    check("questions_source_check", sql`${t.source} in ('revisao', 'material')`),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    total: integer("total").notNull(),
    subjectName: text("subject_name").notNull(),
    submissionId: uuid("submission_id").notNull(),
    correctCount: integer("correct_count").notNull(),
    durationSec: integer("duration_sec").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_attempts_user").on(t.userId, t.createdAt), uniqueIndex("idx_attempts_submission").on(t.userId, t.submissionId), check("attempts_counts_check", sql`${t.total} > 0 and ${t.correctCount} >= 0 and ${t.correctCount} <= ${t.total} and ${t.durationSec} >= 0`)],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedKey: text("selected_key"),
    snapshot: jsonb("snapshot").$type<{ statement: string; options: { key: string; text: string }[]; correctKey: string | null; feedback: string | null }>().notNull(),
    position: integer("position").notNull(),
    isCorrect: boolean("is_correct").notNull(),
  },
  (t) => [index("idx_answers_attempt").on(t.attemptId), uniqueIndex("idx_answers_position").on(t.attemptId, t.position)],
);

export const studyProgress = pgTable(
  "study_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    dueAt: timestamp("due_at").notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_study_progress_user_due").on(t.userId, t.dueAt),
    index("idx_study_progress_question").on(t.questionId),
    uniqueIndex("idx_study_progress_unique").on(t.userId, t.questionId),
    check("study_counts_check", sql`${t.intervalDays} >= 0 and ${t.repetitions} >= 0 and ${t.correctCount} >= 0 and ${t.wrongCount} >= 0`),
  ],
);

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_verify_user").on(t.userId)]);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("idx_audit_created").on(t.createdAt)]);
