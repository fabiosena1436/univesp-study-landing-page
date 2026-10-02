import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { uuid } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { activeEngine, generateQuestions } from "@/lib/ai";
import { ApiError, handleError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return Response.json({ engine: activeEngine() });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    uuid(id);
    await rateLimit("generation", user.id, 5, 60000);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const count =
      typeof body?.count === "number" && Number.isFinite(body.count)
        ? Math.max(1, Math.min(20, Math.floor(body.count)))
        : 10;

    const rows = await db
      .select({
        id: materials.id,
        title: materials.title,
        content: materials.content,
        charCount: materials.charCount,
      })
      .from(materials)
      .where(and(eq(materials.id, id), isNull(materials.archivedAt)))
      .limit(1);
    const material = rows[0];
    if (!material) throw new ApiError(404, "Material não encontrado.");

    const { engine, questions, note } = await generateQuestions(
      material.content,
      count,
      material.title,
    );

    return Response.json({
      engine,
      note,
      available: questions.length,
      questions: questions.map((q, i) => ({
        tempId: `g${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        statement: q.statement,
        options: q.options,
        correctKey: q.correctKey,
        feedback: q.feedback,
        sourceExcerpt: q.sourceExcerpt,
        warnings:
          q.correctKey === null
            ? ["Sem gabarito definido — marque a alternativa correta."]
            : ["Confira o gabarito e o trecho de origem antes de publicar."],
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
