import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (title.length < 2 || title.length > 90 || content.length < 400 || content.length > 400000) throw new ApiError(400, "Use um título de 2 a 90 caracteres e conteúdo de 400 a 400.000 caracteres.");
    const updated = await db.transaction(async (tx) => {
      const original = (await tx.select().from(materials).where(and(eq(materials.id, id), isNull(materials.archivedAt))).limit(1).for("update"))[0];
      if (!original) throw new ApiError(404, "Material não encontrado.");
      if (body.originalTitle !== original.title || body.originalContent !== original.content) throw new ApiError(409, "Este material foi atualizado. Reabra o material antes de editar.");
      const result = (await tx.update(materials).set({ title, content, charCount: content.length }).where(eq(materials.id, id)).returning())[0];
      await audit(user.id, "material.update", id, tx);
      return result;
    });
    return Response.json(updated);
  } catch (e) { return handleError(e); }
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    const rows = await db
      .select({ material: materials })
      .from(materials)
      .innerJoin(subjects, eq(materials.subjectId, subjects.id))
      .where(and(eq(materials.id, id), isNull(materials.archivedAt), isNull(subjects.archivedAt)))
      .limit(1);
    const m = rows[0]?.material;
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
