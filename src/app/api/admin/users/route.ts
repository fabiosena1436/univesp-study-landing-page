import { NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, attemptAnswers, attempts, users, sessions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { pageParams, uuid } from "@/lib/validation";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
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
      .orderBy(desc(users.createdAt), desc(users.id)).limit(limit).offset(offset);
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
    uuid(id);
    if (typeof body?.blocked !== "boolean") throw new ApiError(400, "Informe o estado do bloqueio.");
    const blocked = body.blocked;
    if (!id) throw new ApiError(400, "Usuário inválido.");
    if (id === admin.id && blocked) throw new ApiError(400, "Você não pode bloquear a própria conta.");
    await db.transaction(async (tx) => {
      const targetAdmin = (await tx.select().from(admins).where(eq(admins.userId, id)).limit(1))[0];
      if (targetAdmin) throw new ApiError(403, "Contas administrativas são gerenciadas pelo responsável pelo serviço.");
      const rows = await tx.update(users).set({ isBlocked: blocked }).where(eq(users.id, id)).returning();
      if (!rows.length) throw new ApiError(404, "Usuário não encontrado.");
      if (blocked) await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(admin.id, blocked ? "user.block" : "user.unblock", id, tx);
    });
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
    uuid(id);
    await db.transaction(async (tx) => {
      if ((await tx.select().from(admins).where(eq(admins.userId, id)).limit(1))[0]) throw new ApiError(403, "Contas administrativas são gerenciadas pelo responsável pelo serviço.");
      const removed = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      if (!removed.length) throw new ApiError(404, "Usuário não encontrado.");
      await audit(admin.id, "user.delete", id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
