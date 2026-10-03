import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";
import { validateOptions } from "@/lib/validation";
import { questionFingerprint } from "@/lib/fingerprint";

// Edit wording while preserving alternatives and answers, or complete pending answers.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Questão não encontrada.");
    const body = await req.json().catch(() => null);
    const result = await db.transaction(async (tx) => {
      const q = (await tx.select().from(questions).where(and(eq(questions.id, id), isNull(questions.archivedAt))).limit(1).for("update"))[0];
      if (!q) throw new ApiError(404, "Questão não encontrada.");
      if (body && Object.hasOwn(body, "statement")) {
        if (Object.hasOwn(body, "correctKey") || Object.hasOwn(body, "options")) throw new ApiError(400, "A edição de texto não altera alternativas ou gabarito.");
        const statement = typeof body.statement === "string" ? body.statement.trim() : "";
        const feedback = typeof body.feedback === "string" ? body.feedback.trim() : q.feedback;
        if (statement.length < 15 || statement.length > 12000) throw new ApiError(400, "O enunciado deve ter de 15 a 12.000 caracteres.");
        if (feedback && feedback.length > 20000) throw new ApiError(400, "A explicação deve ter até 20.000 caracteres.");
        if (body.originalStatement !== q.statement || body.originalFeedback !== q.feedback) throw new ApiError(409, "Esta questão foi atualizada. Recarregue a página antes de editar.");
        const fingerprint = questionFingerprint(statement, q.options, q.correctKey);
        const updated = (await tx.update(questions).set({ statement, feedback: feedback || null, fingerprint }).where(eq(questions.id, id)).returning())[0];
        await audit(user.id, "question.text.update", id, tx);
        return updated;
      }
      if (q.correctKey) throw new ApiError(409, "Esta questão já tem gabarito. Atualize o banco antes de continuar.");
      const { correctKey } = validateOptions(q.options, body?.correctKey, true);
      const fingerprint = questionFingerprint(q.statement, q.options, correctKey);
      const updated = (await tx.update(questions).set({ correctKey, fingerprint }).where(eq(questions.id, id)).returning())[0];
      await audit(user.id, "question.answer.complete", id, tx);
      return updated;
    });
    return Response.json(result);
  } catch (e) { return handleError(e); }
}

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Questão não encontrada.");
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.archivedAt)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "Questão não encontrada.");
    await db.transaction(async (tx) => {
      await tx.update(questions).set({ archivedAt: new Date(), fingerprint: null }).where(eq(questions.id, id));
      await audit(user.id, "question.archive", id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
