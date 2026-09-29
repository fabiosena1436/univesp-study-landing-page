import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError, HEX_COLOR_RE, isUuid, str } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

async function getOwned(id: string) {
  const rows = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Matéria não encontrada.");
  return row;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Matéria não encontrada.");
    const subject = await getOwned(id);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

    const values: { name?: string; color?: string } = {};
    if (body?.name !== undefined) {
      const name = str(body.name, 60);
      if (name.length < 2) throw new ApiError(400, "Nome inválido.");
      values.name = name;
    }
    if (body?.color !== undefined) {
      const color = str(body.color, 7);
      if (!HEX_COLOR_RE.test(color)) throw new ApiError(400, "Cor inválida.");
      values.color = color;
    }
    if (Object.keys(values).length === 0) throw new ApiError(400, "Nada para atualizar.");

    const rows = await db
      .update(subjects)
      .set(values)
      .where(eq(subjects.id, subject.id))
      .returning();
    return Response.json(rows[0]);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Matéria não encontrada.");
    const subject = await getOwned(id);
    await db.delete(subjects).where(eq(subjects.id, subject.id));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
