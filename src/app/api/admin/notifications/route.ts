import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, supportTickets, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const since = req.nextUrl.searchParams.get("since");
    if (since && (!Number.isFinite(Date.parse(since)) || since.length > 40)) throw new ApiError(400, "Data de notificação inválida.");
    const [registrations, messages] = await Promise.all([
      db.select({
        registrations: since
          ? sql<number>`count(*) FILTER (WHERE date_trunc('milliseconds', ${users.createdAt}) > ${new Date(since).toISOString()}::timestamp)::int`
          : sql<number>`count(*) FILTER (WHERE ${users.accessStatus}='pending')::int`,
        pending: sql<number>`count(*) FILTER (WHERE ${users.accessStatus}='pending')::int`,
        latestRegistrationAt: sql<string | null>`to_char(max(${users.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
      }).from(users).where(sql`not exists (select 1 from ${admins} where ${admins.userId}=${users.id})`),
      db.select({ unread: sql<number>`count(*)::int`, latestMessageAt: sql<string | null>`to_char(max(${supportTickets.updatedAt}), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` })
        .from(supportTickets).where(sql`(${supportTickets.adminReadAt} IS NULL OR ${supportTickets.adminReadAt}<${supportTickets.updatedAt})`),
    ]);
    return Response.json({ ...registrations[0], ...messages[0], checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}
