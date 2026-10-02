import { NextRequest } from "next/server";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts, questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { gradeAnswers, pageParams, uuid } from "@/lib/validation";
import { updateProgress } from "@/lib/study";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { limit, offset } = pageParams(req.nextUrl.searchParams, 100);
    const rows = await db.select({
      id: attempts.id, subjectId: attempts.subjectId, subjectName: attempts.subjectName,
      total: attempts.total, correctCount: attempts.correctCount, durationSec: attempts.durationSec,
      createdAt: attempts.createdAt,
    }).from(attempts).where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.createdAt), desc(attempts.id)).limit(limit).offset(offset);
    return Response.json(rows);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("attempt", user.id, 30, 60_000);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const subjectId = uuid(str(body?.subjectId, 64));
    const submissionId = uuid(str(body?.submissionId, 64), "Identificador da tentativa inválido.");
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];
    if (!rawAnswers.length || rawAnswers.length > 200) throw new ApiError(400, "Envie de 1 a 200 respostas.");
    const qids = rawAnswers.map((a) => uuid(str((a as Record<string, unknown> | null)?.questionId, 64)));
    const durationSec = typeof body?.durationSec === "number" && Number.isFinite(body.durationSec)
      ? Math.max(0, Math.min(86400, Math.floor(body.durationSec))) : 0;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${user.id + submissionId}, 0))`);
      const previous = (await tx.select().from(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.submissionId, submissionId))).limit(1))[0];
      if (previous) {
        const savedAnswers = await tx.select({ questionId: attemptAnswers.questionId, selectedKey: attemptAnswers.selectedKey, isCorrect: attemptAnswers.isCorrect }).from(attemptAnswers).where(eq(attemptAnswers.attemptId, previous.id));
        return { id: previous.id, total: previous.total, correctCount: previous.correctCount, answers: savedAnswers };
      }
      const sub = (await tx.select().from(subjects).where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt))).limit(1).for("share"))[0];
      if (!sub) throw new ApiError(404, "Matéria não encontrada.");
      const rows = await tx.select().from(questions).where(and(inArray(questions.id, qids), isNull(questions.archivedAt))).for("share");
      const answers = gradeAnswers(rawAnswers, rows, subjectId);
      const correctCount = answers.filter((a) => a.isCorrect).length;
      const [attempt] = await tx.insert(attempts).values({ userId: user.id, subjectId, subjectName: sub.name, submissionId, total: answers.length, correctCount, durationSec }).returning();
      const byId = new Map(rows.map((q) => [q.id, q]));
      await tx.insert(attemptAnswers).values(answers.map((a, position) => {
        const q = byId.get(a.questionId)!;
        return { ...a, attemptId: attempt.id, position, snapshot: { statement: q.statement, options: q.options, correctKey: q.correctKey, feedback: q.feedback } };
      }));
      await updateProgress(tx, user.id, answers.map((a) => ({ questionId: a.questionId, rating: a.isCorrect ? "good" : "hard" })));
      return { id: attempt.id, total: answers.length, correctCount, answers };
    });
    return Response.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}
