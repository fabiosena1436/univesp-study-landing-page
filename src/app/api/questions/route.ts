import { NextRequest } from "next/server";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { pageParams, uuid } from "@/lib/validation";
import { handleError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const sp = req.nextUrl.searchParams;
    const subjectId = sp.get("subjectId") || undefined;
    const q = (sp.get("q") || "").trim().slice(0, 120);

    const { limit, offset } = pageParams(sp);
    const conds: SQL[] = [isNull(questions.archivedAt), isNull(subjects.archivedAt)];
    if (subjectId) uuid(subjectId);
    if (subjectId) conds.push(eq(questions.subjectId, subjectId));
    if (q) conds.push(ilike(questions.statement, `%${q}%`));

    const rows = await db
      .select({ id: questions.id, subjectId: questions.subjectId, materialId: questions.materialId, source: questions.source, statement: questions.statement, options: questions.options, correctKey: questions.correctKey, feedback: questions.feedback, sourceExcerpt: questions.sourceExcerpt, createdAt: questions.createdAt })
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(...conds))
      .orderBy(desc(questions.createdAt), desc(questions.id))
      .limit(limit).offset(offset);
    return Response.json(rows);
  } catch (e) {
    return handleError(e);
  }
}
