import { instrument } from "@/server/services/telemetry";
import { questionFingerprint } from "@/lib/fingerprint";
import { withAiOperation } from "@/lib/aiOperation";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { requireContentManager } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { uuid, validateOptions } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { contentNotice } from "@/lib/contentNotice";
import { rateLimit } from "@/lib/rateLimit";
import { completeQuestionAnswers } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handlePOST(req: NextRequest) {
  try {
    const user = await requireContentManager();
    await rateLimit("import", user.id, 30, 60_000);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const subjectId = uuid(str(body?.subjectId, 64));
    const materialId = body?.materialId ? uuid(str(body.materialId, 64)) : null;
    const list = Array.isArray(body?.questions) ? body.questions : [];
    if (!list.length || list.length > 50) throw new ApiError(400, "Envie de 1 a 50 questões.");
    const input = list.map((item) => {
      const q = item as Record<string, unknown> | null;
      const statement = str(q?.statement, 12000);
      if (statement.length < 8) throw new ApiError(400, "Revise o enunciado antes de completar a questão.");
      const { options, correctKey } = validateOptions(q?.options, q?.correctKey);
      return { statement, options, correctKey, feedback: str(q?.feedback, 20000), sourceExcerpt: str(q?.sourceExcerpt, 2000) };
    });
    let context = "";
    if (materialId) {
      const material = (await db.select({ content: materials.content }).from(materials).where(and(eq(materials.id, materialId), eq(materials.subjectId, subjectId), isNull(materials.archivedAt))).limit(1))[0];
      if (!material) throw new ApiError(400, "O material precisa pertencer à matéria selecionada.");
      context = material.content;
    }
    const completed = await withAiOperation(user.id, req.signal, () => completeQuestionAnswers(input, context));
    const result = await db.transaction(async (tx) => {
      const sub = (await tx.select().from(subjects).where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt))).limit(1).for("share"))[0];
      if (!sub) throw new ApiError(404, "Matéria não encontrada.");
      let content: string | null = null;
      if (materialId) {
        const material = (await tx.select().from(materials).where(and(eq(materials.id, materialId), eq(materials.subjectId, subjectId), isNull(materials.archivedAt))).limit(1).for("share"))[0];
        if (!material) throw new ApiError(400, "O material precisa pertencer à matéria selecionada.");
        content = material.content;
      }
      const clean = completed.map((item, index) => {
        const q = item as Record<string, unknown> | null;
        const statement = str(q?.statement, 12000);
        if (statement.length < 8) throw new ApiError(400, `Questão ${index + 1}: enunciado muito curto.`);
        const { options, correctKey } = validateOptions(q?.options, q?.correctKey);
        const excerpt = str(q?.sourceExcerpt, 2000);
        if (excerpt && (!content || !content.includes(excerpt))) throw new ApiError(400, "O trecho de origem não foi encontrado no material.");
        const fingerprint = questionFingerprint(statement, options, correctKey);
        return { userId: user.id, subjectId, materialId, source: materialId ? "material" : "revisao", statement, options, correctKey, feedback: str(q?.feedback, 20000) || null, sourceExcerpt: excerpt || null, fingerprint };
      });
      const inserted = body?.skipDuplicates
        ? await tx.insert(questions).values(clean).onConflictDoNothing({ target: [questions.subjectId, questions.fingerprint] }).returning({ id: questions.id })
        : await tx.insert(questions).values(clean).returning({ id: questions.id });
      await audit(user.id, "question.import", subjectId, tx);
      if (inserted.length) await contentNotice(tx, user.id, "Novas questões disponíveis", `${inserted.length} nova(s) questão(ões) de ${sub.name}. Acesse Nova prova e escolha essa matéria para praticar.`);
      return { inserted: inserted.length, skipped: clean.length - inserted.length };
    });
    return Response.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}

export const POST = instrument("/api/questions/bulk", "POST", handlePOST);
