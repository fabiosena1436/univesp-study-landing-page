import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Questão não encontrada.");
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, id))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "Questão não encontrada.");
    await db.delete(questions).where(eq(questions.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
