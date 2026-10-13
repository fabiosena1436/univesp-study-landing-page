import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { materialFiles, materials, questions, subjects } from "@/db/schema";
import { audit } from "@/lib/audit";
import { pageParams, uuid } from "@/lib/validation";
import { requireContentManager, requireUser } from "@/lib/auth";
import { PDF_REQUEST_MAX_BYTES } from "@/lib/pdfValidation";
import { rateLimit } from "@/lib/rateLimit";
import { ApiError, handleError, str } from "@/lib/errors";
import { cleanExtractedText, extractPdfText, pdfValidationError } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleGET(req: NextRequest) {
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
        hasPdf: sql<boolean>`exists (select 1 from ${materialFiles} f where f.material_id = ${materials.id})`,
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

async function handlePOST(req: NextRequest) {
  try {
    const user = await requireContentManager();
    await rateLimit("materials.upload", user.id, 15, 60000);
    if (Number(req.headers.get("content-length")) > PDF_REQUEST_MAX_BYTES) throw new ApiError(413, "O envio excede o limite de 4 MB por PDF.");

    const ct = req.headers.get("content-type") ?? "";
    let subjectId = "";
    let title = "";
    let text = "";
    let filename = "texto-colado.txt";
    let pages = 0;
    let pdfData: Buffer | null = null;
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
      if (buf.subarray(0, 5).toString() !== "%PDF-") throw new ApiError(422, "O arquivo não é um PDF válido.");
      pdfData = buf;
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
    if (!pdfData && text.length < 400)
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
      if (pdfData) await tx.insert(materialFiles).values({ materialId: result[0].id, filename, data: pdfData });
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
        hasPdf: Boolean(pdfData),
      },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}

export const GET = instrument("/api/materials", "GET", handleGET);

export const POST = instrument("/api/materials", "POST", handlePOST);
