import { sql } from "drizzle-orm";
import { db } from "@/db";
import { studyProgress } from "@/db/schema";

export type Rating = "hard" | "good" | "easy";
export async function updateProgress(tx: Pick<typeof db, "insert">, userId: string, entries: { questionId: string; rating: Rating }[]) {
  const now = new Date();
  const initial = (rating: Rating) => rating === "hard" ? 1 : rating === "easy" ? 7 : 3;
  // Existing interval is calculated inside the atomic upsert; concurrent reviews cannot duplicate rows or lose counters.
  const interval = sql`CASE WHEN excluded.wrong_count = 1 THEN 1 WHEN excluded.interval_days = 7
    THEN LEAST(60, GREATEST(7, ${studyProgress.intervalDays} * 3))
    ELSE LEAST(30, GREATEST(3, ${studyProgress.intervalDays} * 2)) END`;
  return tx.insert(studyProgress).values(entries.map(({ questionId, rating }) => ({
    userId, questionId, intervalDays: initial(rating), repetitions: 1,
    correctCount: rating === "hard" ? 0 : 1, wrongCount: rating === "hard" ? 1 : 0,
    dueAt: new Date(now.getTime() + initial(rating) * 86400000), lastReviewedAt: now,
  }))).onConflictDoUpdate({
    target: [studyProgress.userId, studyProgress.questionId],
    set: {
      intervalDays: interval,
      dueAt: sql`now() + (${interval}) * interval '1 day'`,
      repetitions: sql`${studyProgress.repetitions} + 1`,
      correctCount: sql`${studyProgress.correctCount} + excluded.correct_count`,
      wrongCount: sql`${studyProgress.wrongCount} + excluded.wrong_count`,
      lastReviewedAt: now,
    },
  }).returning({ dueAt: studyProgress.dueAt, intervalDays: studyProgress.intervalDays });
}
