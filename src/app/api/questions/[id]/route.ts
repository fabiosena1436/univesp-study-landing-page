import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";

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
