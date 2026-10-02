import { NextRequest } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { questions, subjects } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, HEX_COLOR_RE, str } from "@/lib/errors";
import { SUBJECT_COLORS } from "@/lib/constants";

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        color: subjects.color,
        questionCount: sql<number>`count(${questions.id})::int`,
      })
      .from(subjects)
      .leftJoin(questions, and(eq(questions.subjectId, subjects.id), isNull(questions.archivedAt)))
      .where(isNull(subjects.archivedAt))
      .groupBy(subjects.id, subjects.name, subjects.color)
      .orderBy(desc(subjects.createdAt));
    return Response.json(rows);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 60);
    const color = str(body?.color, 7);

    if (name.length < 2) throw new ApiError(400, "Dê um nome para a matéria (mínimo 2 letras).");
    const finalColor = HEX_COLOR_RE.test(color) ? color : SUBJECT_COLORS[0];

    const rows = await db.transaction(async (tx) => {
      const result = await tx
      .insert(subjects)
      .values({ userId: user.id, name, color: finalColor })
      .returning();
      await audit(user.id, "subject.create", result[0].id, tx);
      return result;
    });
    return Response.json(rows[0], { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
