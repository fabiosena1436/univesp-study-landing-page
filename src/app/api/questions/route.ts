import { NextRequest } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const sp = req.nextUrl.searchParams;
    const subjectId = sp.get("subjectId") || undefined;
    const q = (sp.get("q") || "").trim().slice(0, 120);

    const conds: SQL[] = [];
    if (subjectId) conds.push(eq(questions.subjectId, subjectId));
    if (q) conds.push(ilike(questions.statement, `%${q}%`));

    const rows = await db
      .select()
      .from(questions)
      .where(and(...conds))
      .orderBy(desc(questions.createdAt))
      .limit(400);
    return Response.json(rows);
  } catch (e) {
    return handleError(e);
  }
}
