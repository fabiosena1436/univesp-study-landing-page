import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { activeEngine, generateQuestions } from "@/lib/ai";
import { ApiError, handleError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

/* limite de uso: 20 gerações por minuto por usuário (protege a cota da IA) */
const buckets = new Map<string, { count: number; resetAt: number }>();

function tooMany(userId: string): boolean {
  const now = Date.now();
  const b = buckets.get(userId);
  if (b && now < b.resetAt) {
    if (b.count >= 20) return true;
    b.count += 1;
    return false;
  }
  buckets.set(userId, { count: 1, resetAt: now + 60_000 });
  return false;
}

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return Response.json({ engine: activeEngine() });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    if (tooMany(user.id))
      throw new ApiError(429, "Calma lá! Espere um minutinho antes de gerar de novo.");

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
      .where(eq(materials.id, id))
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
        warnings:
          q.correctKey === null
            ? ["Sem gabarito definido — marque a alternativa correta."]
            : [],
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
