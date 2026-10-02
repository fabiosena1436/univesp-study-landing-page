import { NextRequest } from "next/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { pageParams, uuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const admin = user.isAdmin;
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
      })
      .from(supportTickets)
      .innerJoin(users, eq(users.id, supportTickets.userId))
      .where(admin ? undefined : eq(supportTickets.userId, user.id))
      .orderBy(desc(supportTickets.updatedAt), desc(supportTickets.id)).limit(limit).offset(offset);
    const ids = tickets.map((t) => t.id);
    const messages = ids.length
      ? await db.select().from(supportMessages).where(inArray(supportMessages.ticketId, ids)).orderBy(asc(supportMessages.createdAt), asc(supportMessages.id))
      : [];
    return Response.json({ tickets, messages });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("support", user.id, 10, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subject = str(body?.subject, 120);
    const message = str(body?.message, 5000);
    if (subject.length < 3 || message.length < 3)
      throw new ApiError(400, "Informe o assunto e a mensagem.");
    const ticket = await db.transaction(async (tx) => {
    const ticketRows = await tx
      .insert(supportTickets)
      .values({ userId: user.id, subject })
      .returning();
    const ticket = ticketRows[0];
    if (!ticket) throw new ApiError(500, "Não foi possível abrir o atendimento.");
    await tx.insert(supportMessages).values({ ticketId: ticket.id, senderId: user.id, body: message });
    return ticket;
    });
    return Response.json({ id: ticket.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin();
    await rateLimit("support", user.id, 10, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const ticketId = str(body?.ticketId, 64);
    const message = str(body?.message, 5000);
    if (!ticketId || message.length < 3) throw new ApiError(400, "Resposta inválida.");
    uuid(ticketId);
    await db.transaction(async (tx) => {
      const ticket = (await tx.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1).for("update"))[0];
      if (!ticket) throw new ApiError(404, "Atendimento não encontrado.");
      await tx.insert(supportMessages).values({ ticketId, senderId: user.id, body: message });
      await tx.update(supportTickets).set({ status: "answered", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
      await audit(user.id, "support.reply", ticketId, tx);
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
