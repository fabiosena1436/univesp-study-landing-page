import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { normalizeText, LETTERS } from "@/lib/parser";
import { ApiError, handleError, str } from "@/lib/errors";
import type { OptionT } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const subjectId = str(body?.subjectId, 64);
    const skipDuplicates = Boolean(body?.skipDuplicates);
    const source = str(body?.source, 16) === "material" ? "material" : "revisao";
    const rawMaterialId = str(body?.materialId, 64);
    const list = Array.isArray(body?.questions) ? body.questions : [];

    if (!subjectId) throw new ApiError(400, "Escolha a matéria de destino.");
    if (list.length === 0 || list.length > 50)
      throw new ApiError(400, "Lista de questões inválida (1 a 50 por vez).");

    // se as questões vêm de um material, garante que ele pertence ao usuário
    let materialId: string | null = null;
    if (rawMaterialId) {
      const m = await db
        .select({ id: materials.id })
        .from(materials)
        .where(eq(materials.id, rawMaterialId))
        .limit(1);
      if (!m[0]) throw new ApiError(404, "Material não encontrado.");
      materialId = m[0].id;
    }

    const sub = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, subjectId))
      .limit(1);
    if (!sub[0]) throw new ApiError(404, "Matéria não encontrada.");

    const clean: {
      statement: string;
      options: OptionT[];
      correctKey: string | null;
      feedback: string | null;
    }[] = [];

    for (const item of list) {
      const o = (item ?? {}) as Record<string, unknown>;
      const statement = str(o.statement, 12000);
      const rawOpts = Array.isArray(o.options) ? o.options : [];
      const options = rawOpts
        .slice(0, 6)
        .map((x, i) => {
          const xo = (x ?? {}) as Record<string, unknown>;
          return {
            key: (str(xo.key, 1).toUpperCase() || LETTERS[i] || "A"),
            text: str(xo.text, 4000),
          };
        })
        .filter((x) => x.text.length > 0);

      if (statement.length < 8 || options.length < 2) continue;
      const ckRaw = o.correctKey;
      const correctKey =
        typeof ckRaw === "string" &&
        options.some((x) => x.key === ckRaw.toUpperCase())
          ? ckRaw.toUpperCase()
          : null;
      const feedback = str(o.feedback, 20000) || null;
      clean.push({ statement, options, correctKey, feedback });
    }

    if (clean.length === 0)
      throw new ApiError(
        400,
        "Nenhuma questão válida para salvar. Cada questão precisa de enunciado e ao menos 2 alternativas com texto.",
      );

    let skipped = 0;
    let toInsert = clean;
    if (skipDuplicates) {
      const existing = await db
        .select({ statement: questions.statement })
        .from(questions)
        .where(and(eq(questions.userId, user.id), eq(questions.subjectId, subjectId)));
      const seen = new Set(existing.map((r) => normalizeText(r.statement).slice(0, 160)));
      const kept: typeof clean = [];
      for (const c of clean) {
        const key = normalizeText(c.statement).slice(0, 160);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        kept.push(c);
      }
      toInsert = kept;
    }

    for (const c of toInsert) {
      await db
        .insert(questions)
        .values({
          userId: user.id,
          subjectId,
          materialId,
          source,
          statement: c.statement,
          options: c.options,
          correctKey: c.correctKey,
          feedback: c.feedback,
        });
    }

    return Response.json({ inserted: toInsert.length, skipped }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
