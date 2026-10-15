import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, attemptAnswers, attempts, sessions, studyProgress, supportMessages, supportTickets, users, announcements, announcementReads } from "@/db/schema";
import { destroySession, requireAccount, verifyPassword } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";

async function handleGET() {
  try {
    const user = await requireAccount();
    await rateLimit("export", user.id, 3, 3600000);
    const data = await db.transaction(async (tx) => {
      const history = await tx.select().from(attempts).where(eq(attempts.userId, user.id));
      const tickets = await tx.select().from(supportTickets).where(eq(supportTickets.userId, user.id));
      // A transaction uses one pg connection: run queries sequentially on it.
      const answers = history.length ? await tx.select().from(attemptAnswers).where(inArray(attemptAnswers.attemptId, history.map((a) => a.id))) : [];
      const progress = await tx.select().from(studyProgress).where(eq(studyProgress.userId, user.id));
      const messages = tickets.length ? await tx.select().from(supportMessages).where(inArray(supportMessages.ticketId, tickets.map((t) => t.id))) : [];
      const activity = await tx.select({ lastSeenAt: users.lastSeenAt, activityStartedAt: users.activityStartedAt, activeSeconds: users.activeSeconds }).from(users).where(eq(users.id, user.id));
      const notices = await tx.select().from(announcements).where(eq(announcements.recipientId, user.id));
      const noticeReads = await tx.select().from(announcementReads).where(eq(announcementReads.userId, user.id));
      const quotas = await tx.execute(sql`SELECT period, requests, tokens FROM tutor_quotas WHERE key=${user.id}`);
      return { version: 2, exportedAt: new Date().toISOString(), user, activity: activity[0], announcements: notices, announcementReads: noticeReads, tutorQuota: quotas.rows, attempts: history, answers, progress, tickets, messages };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    return Response.json(data, { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="aprova-univesp-dados.json"' } });
  } catch (e) { return handleError(e); }
}

async function handleDELETE(req: NextRequest) {
  try {
    const user = await requireAccount();
    await rateLimit("account.delete", user.id, 5, 600000);
    const body = await req.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    if (body?.confirmation !== "EXCLUIR" || !password || Buffer.byteLength(password, "utf8") > 72) throw new ApiError(400, "Confirme sua senha e digite EXCLUIR.");
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('aprova-admin-management'))`);
      const record = (await tx.select().from(users).where(eq(users.id, user.id)).limit(1).for("update"))[0];
      if (!record || !(await verifyPassword(password, record.passwordHash))) throw new ApiError(400, "Senha incorreta.");
      const adminRows = await tx.select().from(admins);
      if (adminRows.some((a) => a.userId === user.id) && adminRows.length < 2) throw new ApiError(409, "Transfira a administração antes de excluir a última conta administrativa.");
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      await tx.execute(sql`DELETE FROM tutor_quotas WHERE key=${user.id}`);
      await tx.delete(users).where(and(eq(users.id, user.id), eq(users.passwordHash, record.passwordHash)));
    });
    await destroySession();
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

export const GET = instrument("/api/account", "GET", handleGET);

export const DELETE = instrument("/api/account", "DELETE", handleDELETE);
