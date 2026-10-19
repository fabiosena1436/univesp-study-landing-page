import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { pageParams, uuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

async function handleGET(req: NextRequest) {
  try {
    const user = await requireUser();
    const admin = user.isAdmin;
    if (admin) await requireAdmin();
    if (req.nextUrl.searchParams.get("summary") === "1") {
      const readAt = admin ? supportTickets.adminReadAt : supportTickets.userReadAt;
      const [summary] = await db.select({ unread: sql<number>`count(*)::int`, latestMessageAt: sql<string | null>`max(${supportTickets.updatedAt})` }).from(supportTickets).where(and(
        admin ? undefined : eq(supportTickets.userId, user.id),
        sql`(${readAt} IS NULL OR ${readAt} < ${supportTickets.updatedAt})`,
      ));
      return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
    }
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
    const tickets = await db
      .select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        userName: users.name,
        userEmail: users.email,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        userReadAt: supportTickets.userReadAt,
        adminReadAt: supportTickets.adminReadAt,
      })
      .from(supportTickets)
      .innerJoin(users, eq(users.id, supportTickets.userId))
      .where(and(admin ? undefined : eq(supportTickets.userId, user.id), req.nextUrl.searchParams.get("unread") === "1" ? sql`(${admin ? supportTickets.adminReadAt : supportTickets.userReadAt} IS NULL OR ${admin ? supportTickets.adminReadAt : supportTickets.userReadAt} < ${supportTickets.updatedAt})` : undefined))
      .orderBy(desc(supportTickets.updatedAt), desc(supportTickets.id)).limit(limit).offset(offset);
    const ids = tickets.map((t) => t.id);
    const messages = ids.length
      ? await db.select().from(supportMessages).where(inArray(supportMessages.ticketId, ids)).orderBy(asc(supportMessages.createdAt), asc(supportMessages.id))
      : [];
    return Response.json({ tickets, messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("support", user.id, 10, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subject = str(body?.subject, 120);
    const message = str(body?.message, 5000);
    let targetId = user.id;
    if (body?.userId !== undefined) {
      await requireAdmin();
      targetId = uuid(str(body.userId, 64));
      if (!(await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1))[0]) throw new ApiError(404, "Usuário não encontrado.");
    }
    if (subject.length < 3 || message.length < 3)
      throw new ApiError(400, "Informe o assunto e a mensagem.");
    const ticket = await db.transaction(async (tx) => {
    const ticketRows = await tx
      .insert(supportTickets)
      .values({ userId: targetId, subject, ...(user.isAdmin ? { adminReadAt: new Date() } : { userReadAt: new Date() }) })
      .returning();
    const ticket = ticketRows[0];
    if (!ticket) throw new ApiError(500, "Não foi possível abrir o atendimento.");
    await tx.insert(supportMessages).values({ ticketId: ticket.id, senderId: user.id, body: message });
    if (user.isAdmin) await audit(user.id, "support.start", ticket.id, tx);
    return ticket;
    });
    return Response.json({ id: ticket.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.isAdmin) await requireAdmin();
    await rateLimit("support", user.id, 10, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const ticketId = str(body?.ticketId, 64);
    const message = str(body?.message, 5000);
    if (!ticketId || (body?.read !== true && message.length < 3)) throw new ApiError(400, "Resposta inválida.");
    uuid(ticketId);
    await db.transaction(async (tx) => {
      const ticket = (await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1).for("update"))[0];
      if (!ticket) throw new ApiError(404, "Atendimento não encontrado.");
      if (!user.isAdmin && ticket.userId !== user.id) throw new ApiError(404, "Atendimento não encontrado.");
      if (body?.read === true) {
        const viewedAt = body.viewedAt === undefined ? ticket.updatedAt : new Date(str(body.viewedAt, 64));
        if (!Number.isFinite(viewedAt.getTime())) throw new ApiError(400, "Data de leitura inválida.");
        // Preserve PostgreSQL microseconds when acknowledging the latest version.
        const readAt = viewedAt.getTime() >= ticket.updatedAt.getTime() ? supportTickets.updatedAt : viewedAt;
        await tx.update(supportTickets).set(user.isAdmin ? { adminReadAt: readAt } : { userReadAt: readAt }).where(eq(supportTickets.id, ticketId));
        return;
      }
      await tx.insert(supportMessages).values({ ticketId, senderId: user.id, body: message });
      await tx.update(supportTickets).set({ status: user.isAdmin ? "answered" : "open", updatedAt: new Date(), ...(user.isAdmin ? { adminReadAt: new Date(), userReadAt: null } : { userReadAt: new Date(), adminReadAt: null }) }).where(eq(supportTickets.id, ticketId));
      await audit(user.id, "support.reply", ticketId, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export const GET = instrument("/api/support", "GET", handleGET);

export const POST = instrument("/api/support", "POST", handlePOST);

export const PATCH = instrument("/api/support", "PATCH", handlePATCH);
