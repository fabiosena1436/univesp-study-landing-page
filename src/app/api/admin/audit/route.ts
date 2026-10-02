import { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { pageParams } from "@/lib/validation";
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
    return Response.json(await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(limit).offset(offset));
  } catch (e) { return handleError(e); }
}
