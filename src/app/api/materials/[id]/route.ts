import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
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
      .where(eq(materials.id, id))
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
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    const rows = await db
      .select({ id: materials.id })
      .from(materials)
      .where(eq(materials.id, id))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "Material não encontrado.");
    await db.delete(materials).where(eq(materials.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
