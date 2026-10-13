import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ApiError, handleError } from "@/lib/errors";
import { pageParams, uuid } from "@/lib/validation";

async function handleGET(req: NextRequest) {
  try {
    await requireAdmin();
    const status = req.nextUrl.searchParams.get("status") ?? "pending";
    if (!["pending", "approved", "rejected"].includes(status)) throw new ApiError(400, "Estado de acesso inválido.");
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
    const rows = await db.select({ id: users.id, name: users.name, email: users.email, course: users.course, whatsapp: users.whatsapp, accessStatus: users.accessStatus, emailVerifiedAt: users.emailVerifiedAt, isBlocked: users.isBlocked, createdAt: users.createdAt }).from(users).where(and(eq(users.accessStatus, status as "pending" | "approved" | "rejected"), sql`not exists (select 1 from ${admins} where ${admins.userId} = ${users.id})`)).orderBy(desc(users.createdAt), desc(users.id)).limit(limit).offset(offset);
    return Response.json(rows);
  } catch (e) { return handleError(e); }
}

async function handlePATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    uuid(id);
    const status = body?.status;
    if (!["approved", "rejected", "pending"].includes(status)) throw new ApiError(400, "Estado de acesso inválido.");
    await db.transaction(async tx => {
      if ((await tx.select().from(admins).where(eq(admins.userId, id)).limit(1))[0]) throw new ApiError(403, "Não é possível alterar o acesso de uma conta administrativa.");
      const [updated] = await tx.update(users).set({ accessStatus: status }).where(eq(users.id, id)).returning();
      if (!updated) throw new ApiError(404, "Conta não encontrada.");
      await audit(admin.id, `user.access.${status}`, id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

export const GET = instrument("/api/admin/access", "GET", handleGET);

export const PATCH = instrument("/api/admin/access", "PATCH", handlePATCH);
