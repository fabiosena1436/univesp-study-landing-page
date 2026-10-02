import { questionFingerprint } from "@/lib/fingerprint";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { uuid, validateOptions } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    await rateLimit("import", user.id, 30, 60_000);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const subjectId = uuid(str(body?.subjectId, 64));
    const materialId = body?.materialId ? uuid(str(body.materialId, 64)) : null;
    const list = Array.isArray(body?.questions) ? body.questions : [];
    if (!list.length || list.length > 50) throw new ApiError(400, "Envie de 1 a 50 questões.");
    const result = await db.transaction(async (tx) => {
      const sub = (await tx.select().from(subjects).where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt))).limit(1).for("share"))[0];
      if (!sub) throw new ApiError(404, "Matéria não encontrada.");
      let content: string | null = null;
      if (materialId) {
        const material = (await tx.select().from(materials).where(and(eq(materials.id, materialId), eq(materials.subjectId, subjectId), isNull(materials.archivedAt))).limit(1).for("share"))[0];
        if (!material) throw new ApiError(400, "O material precisa pertencer à matéria selecionada.");
        content = material.content;
      }
      const clean = list.map((item, index) => {
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
      return { inserted: inserted.length, skipped: clean.length - inserted.length };
    });
    return Response.json(result, { status: 201 });
  } catch (e) { return handleError(e); }
}
