import { NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, attemptAnswers, attempts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isBlocked: users.isBlocked,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        attempts: sql<number>`count(distinct ${attempts.id})::int`,
        answered: sql<number>`count(${attemptAnswers.id})::int`,
        correct: sql<number>`coalesce(sum(case when ${attemptAnswers.isCorrect} then 1 else 0 end), 0)::int`,
      })
      .from(users)
      .leftJoin(attempts, eq(attempts.userId, users.id))
      .leftJoin(attemptAnswers, eq(attemptAnswers.attemptId, attempts.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));
    const adminRows = await db.select({ userId: admins.userId }).from(admins);
    const adminIds = new Set(adminRows.map((x) => x.userId));
    return Response.json(rows.map((r) => ({ ...r, isAdmin: adminIds.has(r.id) })));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const blocked = body?.blocked === true;
    if (!id) throw new ApiError(400, "Usuário inválido.");
    if (id === admin.id && blocked) throw new ApiError(400, "Você não pode bloquear a própria conta.");
    await db.update(users).set({ isBlocked: blocked }).where(eq(users.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id || id === admin.id) throw new ApiError(400, "Não é possível excluir esta conta.");
    await db.delete(users).where(eq(users.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
