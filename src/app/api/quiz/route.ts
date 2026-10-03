import { NextRequest } from "next/server";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { shuffle } from "@/lib/parser";
import { ApiError, handleError, str } from "@/lib/errors";
import { uuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("quiz", user.id, 30, 60_000);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const subjectId = uuid(str(body?.subjectId, 64));
    const count = typeof body?.count === "number" && Number.isFinite(body.count) ? Math.max(1, Math.min(200, Math.floor(body.count))) : 10;
    const sub = (await db.select().from(subjects).where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt))).limit(1))[0];
    if (!sub) throw new ApiError(404, "Matéria não encontrada.");
    const source = str(body?.source, 16);
    const rows = await db.select().from(questions).where(and(eq(questions.subjectId, subjectId), isNull(questions.archivedAt), isNotNull(questions.correctKey),
      ["material", "revisao"].includes(source) ? eq(questions.source, source) : undefined,
      body?.onlyWrong ? sql`exists (select 1 from attempt_answers a join attempts t on t.id = a.attempt_id where a.question_id = ${questions.id} and t.user_id = ${user.id} and a.is_correct = false)` : undefined,
    )).orderBy(sql`random()`).limit(count);
    let emptyMessage: string | null = null;
    if (!rows.length) {
      const summary = (await db.select({ total: sql<number>`count(*)::int`, ready: sql<number>`count(*) filter (where ${questions.correctKey} is not null)::int` }).from(questions).where(and(eq(questions.subjectId, subjectId), isNull(questions.archivedAt))))[0];
      emptyMessage = !summary.total ? "Esta matéria ainda não tem questões publicadas." : !summary.ready ? `${summary.total} questões estão salvas nesta matéria, mas nenhuma tem gabarito. O administrador precisa marcar a alternativa correta no banco.` : body?.onlyWrong ? "Nenhuma questão com gabarito corresponde aos seus erros e à origem selecionada. Desative o filtro de erros ou escolha Todas." : "Há questões com gabarito nesta matéria, mas nenhuma corresponde à origem selecionada. Escolha Todas ou consulte o banco.";
    }
    return Response.json({ subjectName: sub.name, questions: rows.map((q) => ({ id: q.id, statement: q.statement, options: body?.shuffleOptions !== false ? shuffle(q.options) : q.options, correctKey: q.correctKey, feedback: q.feedback })), emptyMessage });
  } catch (e) { return handleError(e); }
}
