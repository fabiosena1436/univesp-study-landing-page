import { NextRequest } from "next/server";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects, studyProgress } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

const DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const due = await db
      .select({
        id: questions.id,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        statement: questions.statement,
        options: questions.options,
        correctKey: questions.correctKey,
        feedback: questions.feedback,
        dueAt: studyProgress.dueAt,
        repetitions: studyProgress.repetitions,
        intervalDays: studyProgress.intervalDays,
      })
      .from(studyProgress)
      .innerJoin(questions, eq(questions.id, studyProgress.questionId))
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(eq(studyProgress.userId, user.id), lte(studyProgress.dueAt, now)))
      .orderBy(asc(studyProgress.dueAt))
      .limit(20);

    const [tracked] = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyProgress)
      .where(eq(studyProgress.userId, user.id));
    const [mastered] = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyProgress)
      .where(and(eq(studyProgress.userId, user.id), sql`${studyProgress.intervalDays} >= 15`));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [today] = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyProgress)
      .where(and(eq(studyProgress.userId, user.id), sql`${studyProgress.lastReviewedAt} >= ${start}`));

    return Response.json({
      due,
      dueCount: due.length,
      totalTracked: Number(tracked?.count ?? 0),
      masteredCount: Number(mastered?.count ?? 0),
      reviewedToday: Number(today?.count ?? 0),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const questionId = str(body?.questionId, 64);
    const rating = str(body?.rating, 12);
    if (!questionId || !["hard", "good", "easy"].includes(rating)) {
      throw new ApiError(400, "Informe a questão e uma dificuldade válida.");
    }

    const question = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);
    if (!question[0]) throw new ApiError(404, "Questão não encontrada.");

    const existing = await db
      .select()
      .from(studyProgress)
      .where(and(eq(studyProgress.userId, user.id), eq(studyProgress.questionId, questionId)))
      .limit(1);
    const current = existing[0];
    const oldInterval = current?.intervalDays ?? 0;
    const oldRepetitions = current?.repetitions ?? 0;
    const intervalDays =
      rating === "hard"
        ? 1
        : rating === "good"
          ? Math.min(30, Math.max(2, oldInterval === 0 ? 3 : Math.round(oldInterval * 2)))
          : Math.min(60, Math.max(7, oldInterval === 0 ? 7 : Math.round(oldInterval * 3)));
    const dueAt = new Date(Date.now() + intervalDays * DAY);
    const values = {
      userId: user.id,
      questionId,
      intervalDays,
      repetitions: oldRepetitions + 1,
      correctCount: (current?.correctCount ?? 0) + (rating === "hard" ? 0 : 1),
      wrongCount: (current?.wrongCount ?? 0) + (rating === "hard" ? 1 : 0),
      dueAt,
      lastReviewedAt: new Date(),
    };
    if (current) {
      await db.update(studyProgress).set(values).where(eq(studyProgress.id, current.id));
    } else {
      await db.insert(studyProgress).values(values);
    }
    return Response.json({ dueAt, intervalDays });
  } catch (e) {
    return handleError(e);
  }
}
