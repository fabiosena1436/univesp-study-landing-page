import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";
import { validateOptions } from "@/lib/validation";
import { questionFingerprint } from "@/lib/fingerprint";

// Complete pending answers without rewriting an already published answer.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Questão não encontrada.");
    const body = await req.json().catch(() => null);
    const result = await db.transaction(async (tx) => {
      const q = (await tx.select().from(questions).where(and(eq(questions.id, id), isNull(questions.archivedAt))).limit(1).for("update"))[0];
      if (!q) throw new ApiError(404, "Questão não encontrada.");
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
