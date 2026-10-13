import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { subjects, materials, questions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireContentManager, requireAdmin } from "@/lib/auth";
import { ApiError, handleError, HEX_COLOR_RE, isUuid, str } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

async function getOwned(id: string) {
  const rows = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, id), isNull(subjects.archivedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, "Matéria não encontrada.");
  return row;
}

async function handlePATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireContentManager();
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

    const rows = await db.transaction(async (tx) => {
      const result = await tx
      .update(subjects)
      .set(values)
      .where(eq(subjects.id, subject.id))
      .returning();
      await audit(user.id, "subject.update", id, tx);
      return result;
    });
    return Response.json(rows[0]);
  } catch (e) {
    return handleError(e);
  }
}

async function handleDELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Matéria não encontrada.");
    const subject = await getOwned(id);
    await db.transaction(async (tx) => {
      const archivedAt = new Date();
      await tx.update(subjects).set({ archivedAt }).where(eq(subjects.id, subject.id));
      await tx.update(materials).set({ archivedAt }).where(eq(materials.subjectId, id));
      await tx.update(questions).set({ archivedAt, fingerprint: null }).where(eq(questions.subjectId, id));
      await audit(user.id, "subject.archive", id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export const PATCH = instrument("/api/subjects/[id]", "PATCH", handlePATCH);

export const DELETE = instrument("/api/subjects/[id]", "DELETE", handleDELETE);
