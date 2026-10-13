import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { authorizedEmails, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { parseAuthorizedEmails } from "@/lib/access";
import { audit } from "@/lib/audit";
import { ApiError, handleError, str } from "@/lib/errors";
import { pageParams } from "@/lib/validation";

async function handleGET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
    return Response.json(await db.select().from(authorizedEmails).orderBy(desc(authorizedEmails.createdAt), authorizedEmails.email).limit(limit).offset(offset));
  } catch (e) { return handleError(e); }
}

async function handlePOST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    let emails: string[];
    try { emails = parseAuthorizedEmails(body?.emails); }
    catch (e) { throw new ApiError(400, e instanceof Error ? e.message : "E-mails inválidos."); }
    const added = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('registration-approval'))`);
      const rows = await tx.insert(authorizedEmails).values(emails.map(email => ({ email, addedBy: admin.id }))).onConflictDoNothing().returning();
      await tx.update(users).set({ accessStatus: "approved" }).where(and(inArray(users.email, emails), eq(users.accessStatus, "pending")));
      await audit(admin.id, "access.emails.add", `${rows.length} e-mails adicionados`, tx);
      return rows.length;
    });
    return Response.json({ added, duplicates: emails.length - added });
  } catch (e) { return handleError(e); }
}

async function handleDELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const email = str(req.nextUrl.searchParams.get("email"), 200).toLowerCase();
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('registration-approval'))`);
      const removed = await tx.delete(authorizedEmails).where(eq(authorizedEmails.email, email)).returning();
      if (!removed.length) throw new ApiError(404, "E-mail não encontrado.");
      await audit(admin.id, "access.email.remove", email, tx);
    });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

export const GET = instrument("/api/admin/authorized-emails", "GET", handleGET);

export const POST = instrument("/api/admin/authorized-emails", "POST", handlePOST);

export const DELETE = instrument("/api/admin/authorized-emails", "DELETE", handleDELETE);
