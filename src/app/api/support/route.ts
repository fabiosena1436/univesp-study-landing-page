import { NextRequest } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages, supportTickets, users } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireUser();
    const admin = user.isAdmin;
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
      .orderBy(desc(supportTickets.updatedAt));
    const ids = tickets.map((t) => t.id);
    const messages = ids.length
      ? await db.select().from(supportMessages).where(inArray(supportMessages.ticketId, ids))
      : [];
    return Response.json({ tickets, messages });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subject = str(body?.subject, 120);
    const message = str(body?.message, 5000);
    if (subject.length < 3 || message.length < 3)
      throw new ApiError(400, "Informe o assunto e a mensagem.");
    const ticketRows = await db
      .insert(supportTickets)
      .values({ userId: user.id, subject })
      .returning();
    const ticket = ticketRows[0];
    if (!ticket) throw new ApiError(500, "Não foi possível abrir o atendimento.");
    await db.insert(supportMessages).values({ ticketId: ticket.id, senderId: user.id, body: message });
    return Response.json({ id: ticket.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const ticketId = str(body?.ticketId, 64);
    const message = str(body?.message, 5000);
    if (!ticketId || message.length < 3) throw new ApiError(400, "Resposta inválida.");
    await db.insert(supportMessages).values({ ticketId, senderId: user.id, body: message });
    await db.update(supportTickets).set({ status: "answered", updatedAt: new Date() }).where(eq(supportTickets.id, ticketId));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
