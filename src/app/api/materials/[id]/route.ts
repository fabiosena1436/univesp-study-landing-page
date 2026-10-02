import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    const rows = await db
      .select()
      .from(materials)
      .where(and(eq(materials.id, id), isNull(materials.archivedAt)))
      .limit(1);
    const m = rows[0];
    if (!m) throw new ApiError(404, "Material não encontrado.");
    return Response.json({
      id: m.id,
      subjectId: m.subjectId,
      title: m.title,
      filename: m.filename,
      pageCount: m.pageCount,
      charCount: m.charCount,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    const rows = await db
      .select({ id: materials.id })
      .from(materials)
      .where(and(eq(materials.id, id), isNull(materials.archivedAt)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "Material não encontrado.");
    await db.transaction(async (tx) => {
      const archivedAt = new Date();
      await tx.update(materials).set({ archivedAt }).where(eq(materials.id, id));
      await tx.update(questions).set({ archivedAt, fingerprint: null }).where(eq(questions.materialId, id));
      await audit(user.id, "material.archive", id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
