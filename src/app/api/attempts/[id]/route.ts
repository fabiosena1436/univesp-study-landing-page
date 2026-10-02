import { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";
type Params = { params: Promise<{ id: string }> };
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Prova não encontrada.");
    const attempt = (await db.select().from(attempts).where(and(eq(attempts.id, id), eq(attempts.userId, user.id))).limit(1))[0];
    if (!attempt) throw new ApiError(404, "Prova não encontrada.");
    const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, id)).orderBy(asc(attemptAnswers.position));
    return Response.json({ id: attempt.id, subjectName: attempt.subjectName, total: attempt.total, correctCount: attempt.correctCount, durationSec: attempt.durationSec,
      createdAt: attempt.createdAt.toISOString(), answers: answers.map((a) => ({ ...a.snapshot, selectedKey: a.selectedKey, isCorrect: a.isCorrect })) });
  } catch (e) { return handleError(e); }
}
