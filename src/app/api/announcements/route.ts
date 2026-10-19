import { NextRequest } from "next/server";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { announcementReads, announcements, users } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { uuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(), manage = req.nextUrl.searchParams.get("manage") === "1";
    if (manage) await requireAdmin();
    const rows = await db.select({ id: announcements.id, title: announcements.title, body: announcements.body, active: announcements.active,
      recipientId: announcements.recipientId, recipientName: users.name, createdAt: announcements.createdAt, readAt: announcementReads.readAt })
      .from(announcements).leftJoin(users, eq(users.id, announcements.recipientId))
      .leftJoin(announcementReads, and(eq(announcementReads.announcementId, announcements.id), eq(announcementReads.userId, user.id)))
      .where(manage ? undefined : and(eq(announcements.active, true), or(isNull(announcements.recipientId), eq(announcements.recipientId, user.id)), req.nextUrl.searchParams.get("unread") === "1" ? isNull(announcementReads.readAt) : undefined))
      .orderBy(desc(announcements.createdAt), desc(announcements.id)).limit(50);
    return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await rateLimit("announcements.publish", admin.id, 10, 60000);
    const body = await req.json().catch(() => null), title = str(body?.title, 120), message = str(body?.body, 5000);
    if (title.length < 3 || message.length < 3) throw new ApiError(400, "Informe título e recado com pelo menos três caracteres.");
    const recipientId = body?.recipientId ? uuid(str(body.recipientId, 64)) : null;
    if (recipientId && !(await db.select({ id: users.id }).from(users).where(eq(users.id, recipientId)).limit(1))[0]) throw new ApiError(404, "Destinatário não encontrado.");
    const notice = await db.transaction(async tx => {
      const [row] = await tx.insert(announcements).values({ authorId: admin.id, recipientId, title, body: message }).returning({ id: announcements.id });
      await audit(admin.id, "announcement.publish", row.id, tx);
      return row;
    });
    return Response.json(notice, { status: 201 });
  } catch (e) { return handleError(e); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(), body = await req.json().catch(() => null), id = uuid(str(body?.id, 64));
    if (body?.read === true) {
      const [row] = await db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.id, id), eq(announcements.active, true), or(isNull(announcements.recipientId), eq(announcements.recipientId, user.id)))).limit(1);
      if (!row) throw new ApiError(404, "Recado não encontrado.");
      await db.insert(announcementReads).values({ announcementId: id, userId: user.id }).onConflictDoNothing();
    } else {
      await requireAdmin();
      if (typeof body?.active !== "boolean") throw new ApiError(400, "Informe o estado do recado.");
      await db.transaction(async tx => {
        const rows = await tx.update(announcements).set({ active: body.active }).where(eq(announcements.id, id)).returning({ id: announcements.id });
        if (!rows.length) throw new ApiError(404, "Recado não encontrado.");
        await audit(user.id, body.active ? "announcement.activate" : "announcement.archive", id, tx);
      });
    }
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
