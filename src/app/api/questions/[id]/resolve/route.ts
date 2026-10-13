import { instrument } from "@/server/services/telemetry";
import { withAiOperation } from "@/lib/aiOperation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions } from "@/db/schema";
import { requireContentManager } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { completeQuestionAnswers } from "@/lib/ai";
import { ApiError, handleError } from "@/lib/errors";
import { questionFingerprint } from "@/lib/fingerprint";
import { rateLimit } from "@/lib/rateLimit";
import { uuid } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireContentManager();
    const { id } = await params;
    uuid(id);
    await rateLimit("generation", user.id, 5, 60000);
    const original = (await db.select().from(questions).where(and(eq(questions.id, id), isNull(questions.archivedAt))).limit(1))[0];
    if (!original) throw new ApiError(404, "Questão não encontrada.");
    if (original.correctKey && original.feedback?.trim()) return Response.json(original);
    const material = original.materialId ? (await db.select({ content: materials.content }).from(materials).where(and(eq(materials.id, original.materialId), isNull(materials.archivedAt))).limit(1))[0] : null;
    const [resolved] = await withAiOperation(user.id, req.signal, () => completeQuestionAnswers([{ statement: original.statement, options: original.options, correctKey: original.correctKey, feedback: original.feedback ?? "" }], material?.content ?? ""));
    const result = await db.transaction(async (tx) => {
      const current = (await tx.select().from(questions).where(and(eq(questions.id, id), isNull(questions.archivedAt))).limit(1).for("update"))[0];
      if (!current) throw new ApiError(404, "Questão não encontrada.");
      if (current.statement !== original.statement || current.correctKey !== original.correctKey || current.feedback !== original.feedback || JSON.stringify(current.options) !== JSON.stringify(original.options) || current.materialId !== original.materialId) throw new ApiError(409, "A questão foi alterada durante a resolução. Recarregue e tente novamente.");
      const [updated] = await tx.update(questions).set({ correctKey: resolved.correctKey, feedback: resolved.feedback, fingerprint: questionFingerprint(current.statement, current.options, resolved.correctKey) }).where(eq(questions.id, id)).returning();
      await audit(user.id, "question.ai.complete", id, tx);
      return updated;
    });
    return Response.json(result);
  } catch (error) { return handleError(error); }
}

export const POST = instrument("/api/questions/[id]/resolve", "POST", handlePOST);
