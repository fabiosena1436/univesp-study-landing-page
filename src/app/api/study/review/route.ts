import { NextRequest } from "next/server";
import { and, asc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects, studyProgress } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { uuid } from "@/lib/validation";
import { updateProgress, type Rating } from "@/lib/study";
import { rateLimit } from "@/lib/rateLimit";
export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const active = and(eq(studyProgress.userId, user.id), isNull(questions.archivedAt), isNull(subjects.archivedAt), isNotNull(questions.correctKey));
    const [due, stats] = await Promise.all([
      db.select({ id: questions.id, subjectId: questions.subjectId, subjectName: subjects.name, statement: questions.statement, options: questions.options, correctKey: questions.correctKey, feedback: questions.feedback,
        dueAt: studyProgress.dueAt, repetitions: studyProgress.repetitions, intervalDays: studyProgress.intervalDays,
      }).from(studyProgress).innerJoin(questions, eq(questions.id, studyProgress.questionId)).innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(and(active, lte(studyProgress.dueAt, now))).orderBy(asc(studyProgress.dueAt), asc(studyProgress.id)).limit(20),
      db.select({ totalTracked: sql<number>`count(*)::int`, dueCount: sql<number>`count(*) filter (where ${studyProgress.dueAt} <= ${now})::int`,
        masteredCount: sql<number>`count(*) filter (where ${studyProgress.intervalDays} >= 15)::int`,
        reviewedToday: sql<number>`count(*) filter (where ${studyProgress.lastReviewedAt} >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') at time zone 'UTC')::int`,
      }).from(studyProgress).innerJoin(questions, eq(questions.id, studyProgress.questionId)).innerJoin(subjects, eq(subjects.id, questions.subjectId)).where(active),
    ]);
    return Response.json({ due, ...stats[0] });
  } catch (e) { return handleError(e); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("review", user.id, 100, 60_000);
    const body = await req.json().catch(() => null);
    const questionId = uuid(str(body?.questionId, 64));
    const rating = str(body?.rating, 12);
    if (!["hard", "good", "easy"].includes(rating)) throw new ApiError(400, "Dificuldade inválida.");
    const result = await db.transaction(async (tx) => {
      const row = (await tx.select({ id: questions.id }).from(questions).innerJoin(subjects, eq(subjects.id, questions.subjectId)).where(and(eq(questions.id, questionId), isNull(questions.archivedAt), isNull(subjects.archivedAt), isNotNull(questions.correctKey))).limit(1).for("share"))[0];
      if (!row) throw new ApiError(404, "Questão não encontrada ou sem gabarito.");
      const [progress] = await updateProgress(tx, user.id, [{ questionId, rating: rating as Rating }]);
      return progress;
    });
    return Response.json(result);
  } catch (e) { return handleError(e); }
}
