import { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts, questions, subjects, studyProgress } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db
      .select({
        id: attempts.id,
        subjectId: attempts.subjectId,
        subjectName: subjects.name,
        total: attempts.total,
        correctCount: attempts.correctCount,
        durationSec: attempts.durationSec,
        createdAt: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(subjects, eq(subjects.id, attempts.subjectId))
      .where(eq(attempts.userId, user.id))
      .orderBy(desc(attempts.createdAt))
      .limit(100);
    return Response.json(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subjectId = str(body?.subjectId, 64);
    const durationSec =
      typeof body?.durationSec === "number" && Number.isFinite(body.durationSec)
        ? Math.max(0, Math.min(86400, Math.floor(body.durationSec)))
        : 0;
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];

    if (!subjectId) throw new ApiError(400, "Prova sem matéria.");
    if (rawAnswers.length === 0 || rawAnswers.length > 200)
      throw new ApiError(400, "Respostas inválidas.");

    const sub = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);
    if (!sub[0]) throw new ApiError(404, "Matéria não encontrada.");

    // valida que as questões pertencem ao usuário
    const qids = rawAnswers
      .map((a) => str(((a ?? {}) as Record<string, unknown>).questionId, 64))
      .filter(Boolean);
    const owned = await db
      .select({ id: questions.id })
      .from(questions)
      .where(inArray(questions.id, qids));
    const ownedSet = new Set(owned.map((r) => r.id));

    const answers = rawAnswers
      .map((a) => {
        const x = (a ?? {}) as Record<string, unknown>;
        const questionId = str(x.questionId, 64);
        return {
          questionId,
          selectedKey:
            typeof x.selectedKey === "string" ? x.selectedKey.toUpperCase().slice(0, 1) : null,
          isCorrect: Boolean(x.isCorrect),
        };
      })
      .filter((a) => a.questionId && ownedSet.has(a.questionId));

    if (answers.length === 0) throw new ApiError(400, "Nenhuma resposta válida registrada.");

    const total = answers.length;
    const correctCount = answers.filter((a) => a.isCorrect).length;

    const attemptRows = await db
      .insert(attempts)
      .values({ userId: user.id, subjectId, total, correctCount, durationSec })
      .returning();
    const attempt = attemptRows[0];
    if (!attempt) throw new ApiError(500, "Não foi possível salvar a prova.");

    await db.insert(attemptAnswers).values(
      answers.map((a) => ({
        attemptId: attempt.id,
        questionId: a.questionId,
        selectedKey: a.selectedKey,
        isCorrect: a.isCorrect,
      })),
    );

    for (const answer of answers) {
      const current = await db
        .select()
        .from(studyProgress)
        .where(and(eq(studyProgress.userId, user.id), eq(studyProgress.questionId, answer.questionId)))
        .limit(1);
      const row = current[0];
      const intervalDays = answer.isCorrect
        ? Math.min(30, Math.max(3, row?.intervalDays ? Math.round(row.intervalDays * 2) : 3))
        : 1;
      const values = {
        userId: user.id,
        questionId: answer.questionId,
        intervalDays,
        repetitions: (row?.repetitions ?? 0) + 1,
        correctCount: (row?.correctCount ?? 0) + (answer.isCorrect ? 1 : 0),
        wrongCount: (row?.wrongCount ?? 0) + (answer.isCorrect ? 0 : 1),
        dueAt: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
        lastReviewedAt: new Date(),
      };
      if (row) {
        await db.update(studyProgress).set(values).where(eq(studyProgress.id, row.id));
      } else {
        await db.insert(studyProgress).values(values);
      }
    }

    return Response.json({ id: attempt.id, total, correctCount }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
