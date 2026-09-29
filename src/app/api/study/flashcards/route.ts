import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handleError, str } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const subjectId = str(req.nextUrl.searchParams.get("subjectId"), 64);
    const limit = Math.min(30, Math.max(5, Number(req.nextUrl.searchParams.get("limit") ?? 10) || 10));
    const rows = await db
      .select({
        id: questions.id,
        subjectId: questions.subjectId,
        subjectName: subjects.name,
        front: questions.statement,
        back: questions.correctKey,
        options: questions.options,
        feedback: questions.feedback,
      })
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(subjectId ? eq(questions.subjectId, subjectId) : undefined)
      .orderBy(sql`random()`)
      .limit(limit);

    return Response.json(rows.map((row) => {
      const correct = row.options.find((option) => option.key === row.back);
      return {
        id: row.id,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        front: row.front,
        back: correct ? `${correct.key}. ${correct.text}` : "Resposta ainda não cadastrada.",
        feedback: row.feedback,
      };
    }));
  } catch (e) {
    return handleError(e);
  }
}
