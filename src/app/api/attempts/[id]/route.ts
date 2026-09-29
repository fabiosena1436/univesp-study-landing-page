import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts, questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";
import type { AttemptDetail } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Prova não encontrada.");

    const rows = await db
      .select({
        id: attempts.id,
        subjectName: subjects.name,
        total: attempts.total,
        correctCount: attempts.correctCount,
        durationSec: attempts.durationSec,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(subjects, eq(subjects.id, attempts.subjectId))
      .where(and(eq(attempts.id, id), eq(attempts.userId, user.id)))
      .limit(1);
    const attempt = rows[0];
    if (!attempt) throw new ApiError(404, "Prova não encontrada.");

    const answerRows = await db
      .select({
        selectedKey: attemptAnswers.selectedKey,
        isCorrect: attemptAnswers.isCorrect,
        statement: questions.statement,
        options: questions.options,
        correctKey: questions.correctKey,
        feedback: questions.feedback,
      })
      .from(attemptAnswers)
      .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
      .where(eq(attemptAnswers.attemptId, id));

    const detail: AttemptDetail = {
      ...attempt,
      createdAt: attempt.createdAt.toISOString(),
      answers: answerRows.map((a) => ({ ...a })),
    };
    return Response.json(detail);
  } catch (e) {
    return handleError(e);
  }
}
