import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attemptAnswers, attempts, questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { shuffle } from "@/lib/parser";
import { ApiError, handleError, str } from "@/lib/errors";
import type { QuizQuestion } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subjectId = str(body?.subjectId, 64);
    const count =
      typeof body?.count === "number" && Number.isFinite(body.count)
        ? Math.max(1, Math.min(200, Math.floor(body.count)))
        : 10;
    const shuffleOptions = body?.shuffleOptions !== false;
    const onlyWrong = Boolean(body?.onlyWrong);
    const sourceFilter = str(body?.source, 16);

    if (!subjectId) throw new ApiError(400, "Escolha a matéria da prova.");

    const sub = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);
    if (!sub[0]) throw new ApiError(404, "Matéria não encontrada.");

    let rows = await db
      .select()
      .from(questions)
      .where(eq(questions.subjectId, subjectId));

    if (sourceFilter === "material" || sourceFilter === "revisao") {
      rows = rows.filter((r) => r.source === sourceFilter);
    }

    if (onlyWrong) {
      const wrongRows = await db
        .select({ qid: attemptAnswers.questionId })
        .from(attemptAnswers)
        .innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
        .where(
          and(
            eq(attempts.userId, user.id),
            eq(attemptAnswers.isCorrect, false),
            eq(attemptAnswers.questionId, attemptAnswers.questionId),
          ),
        );
      const wrongSet = new Set(wrongRows.map((r) => r.qid));
      rows = rows.filter((r) => wrongSet.has(r.id));
    }

    if (rows.length === 0) {
      return Response.json({
        questions: [] as QuizQuestion[],
        subjectName: sub[0].name,
        emptyMessage: onlyWrong
          ? "Você ainda não errou nenhuma questão nessa matéria — que tal uma prova completa?"
          : "Essa matéria ainda não tem questões no banco. Importe primeiro!",
      });
    }

    const picked = shuffle(rows).slice(0, Math.min(count, rows.length));
    const payload: QuizQuestion[] = picked.map((q) => ({
      id: q.id,
      statement: q.statement,
      options: shuffleOptions ? shuffle(q.options) : q.options,
      correctKey: q.correctKey,
      feedback: q.feedback,
    }));

    return Response.json({ questions: payload, subjectName: sub[0].name, emptyMessage: null });
  } catch (e) {
    return handleError(e);
  }
}
