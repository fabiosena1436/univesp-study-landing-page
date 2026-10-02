import { NextRequest } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { audit } from "@/lib/audit";
import { pageParams, uuid } from "@/lib/validation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { cleanExtractedText, extractPdfText, pdfValidationError } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { limit, offset } = pageParams(req.nextUrl.searchParams);
    const rows = await db
      .select({
        id: materials.id,
        subjectId: materials.subjectId,
        subjectName: subjects.name,
        title: materials.title,
        filename: materials.filename,
        pageCount: materials.pageCount,
        charCount: materials.charCount,
        questionCount: sql<number>`(
          select count(*)::int from ${questions} q where q.material_id = ${materials.id} and q.archived_at is null
        )`,
        createdAt: materials.createdAt,
      })
      .from(materials)
      .innerJoin(subjects, eq(subjects.id, materials.subjectId))
      .where(and(isNull(materials.archivedAt), isNull(subjects.archivedAt)))
      .orderBy(desc(materials.createdAt), desc(materials.id))
      .limit(limit).offset(offset);

    return Response.json(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();

    const ct = req.headers.get("content-type") ?? "";
    let subjectId = "";
    let title = "";
    let text = "";
    let filename = "texto-colado.txt";
    let pages = 0;
    let sourceKind: "pdf" | "texto" = "texto";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      subjectId = str(form.get("subjectId"), 64);
      title = str(form.get("title"), 90);
      const file = form.get("file");
      if (!(file instanceof File)) throw new ApiError(400, "Anexe o arquivo PDF da aula.");

      const bad = pdfValidationError(file.name, file.type, file.size);
      if (bad) throw new ApiError(400, bad);

      const buf = Buffer.from(await file.arrayBuffer());
      try {
        const { text: extracted, pages: p } = await extractPdfText(buf);
        pages = p;
        text = cleanExtractedText(extracted);
      } catch {
        throw new ApiError(
          422,
          "Não consegui ler esse PDF. Ele pode estar protegido por senha ou corrompido.",
        );
      }
      filename = file.name.slice(0, 160);
      sourceKind = "pdf";
      if (!title) title = file.name.replace(/\.pdf$/i, "").slice(0, 80);
    } else {
      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      subjectId = str(body?.subjectId, 64);
      title = str(body?.title, 90);
      text = cleanExtractedText(typeof body?.text === "string" ? body.text : "");
      if (typeof body?.filename === "string" && body.filename) filename = str(body.filename, 160);
    }

    uuid(subjectId);
    if (!subjectId) throw new ApiError(400, "Escolha a matéria do material.");
    if (text.length < 400)
      throw new ApiError(
        422,
        text.length === 0
          ? "Não encontrei texto nesse PDF — provavelmente ele é digitalizado (imagem)."
          : `O texto extraído ficou curto (${text.length} caracteres). Envie um PDF com mais conteúdo ou cole o texto manualmente.`,
      );
    if (text.length > 400000)
      throw new ApiError(413, "O material é enorme. Divida em dois materiais menores.");

    const sub = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), isNull(subjects.archivedAt)))
      .limit(1);
    if (!sub[0]) throw new ApiError(404, "Matéria não encontrada.");

    const rows = await db.transaction(async (tx) => {
      const result = await tx
      .insert(materials)
      .values({
        userId: user.id,
        subjectId,
        title: title || filename,
        filename,
        content: text,
        pageCount: pages,
        charCount: text.length,
      })
      .returning();
      await audit(user.id, "material.create", result[0].id, tx);
      return result;
    });
    const material = rows[0];
    if (!material) throw new ApiError(500, "Não foi possível salvar o material.");

    return Response.json(
      {
        id: material.id,
        subjectId: material.subjectId,
        title: material.title,
        filename: material.filename,
        pageCount: material.pageCount,
        charCount: material.charCount,
        createdAt: material.createdAt.toISOString(),
        kind: sourceKind,
      },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
