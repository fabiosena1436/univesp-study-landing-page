import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { materialFiles, materials, subjects } from "@/db/schema";
import { requireContentManager, requireUser } from "@/lib/auth";
import { ApiError, handleError, isUuid } from "@/lib/errors";
import { extractPdfText, pdfValidationError } from "@/lib/pdf";
import { PDF_REQUEST_MAX_BYTES } from "@/lib/pdfValidation";
import { rateLimit } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;
type Params = { params: Promise<{ id: string }> };

async function handleGET(req: NextRequest, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "PDF não encontrado.");
    const [file] = await db.select({ data: materialFiles.data, filename: materialFiles.filename })
      .from(materialFiles).innerJoin(materials, eq(materialFiles.materialId, materials.id))
      .innerJoin(subjects, eq(materials.subjectId, subjects.id))
      .where(and(eq(materials.id, id), isNull(materials.archivedAt), isNull(subjects.archivedAt))).limit(1);
    if (!file) throw new ApiError(404, "Este material ainda não tem um PDF anexado.");
    return new Response(new Uint8Array(file.data), { headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.data.length),
      "Content-Disposition": `${req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="material.pdf"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    } });
  } catch (e) { return handleError(e); }
}

async function handlePOST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireContentManager();
    await rateLimit("materials.attach", user.id, 15, 60000);
    const { id } = await params;
    if (!isUuid(id)) throw new ApiError(404, "Material não encontrado.");
    if (Number(req.headers.get("content-length")) > PDF_REQUEST_MAX_BYTES) throw new ApiError(413, "O envio excede o limite de 4 MB por PDF.");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Anexe um PDF.");
    const bad = pdfValidationError(file.name, file.type, file.size);
    if (bad) throw new ApiError(400, bad);
    const data = Buffer.from(await file.arrayBuffer());
    if (data.subarray(0, 5).toString() !== "%PDF-") throw new ApiError(422, "O arquivo não é um PDF válido.");
    try { await extractPdfText(data); }
    catch { throw new ApiError(422, "Não foi possível ler este PDF. Use um arquivo válido, sem senha e com até 500 páginas."); }
    await db.transaction(async (tx) => {
      const [material] = await tx.select({ id: materials.id }).from(materials)
        .innerJoin(subjects, eq(materials.subjectId, subjects.id))
        .where(and(eq(materials.id, id), isNull(materials.archivedAt), isNull(subjects.archivedAt))).limit(1).for("update");
      if (!material) throw new ApiError(404, "Material não encontrado.");
      const [existing] = await tx.select({ id: materialFiles.materialId }).from(materialFiles).where(eq(materialFiles.materialId, id)).limit(1);
      if (existing && form.get("replace") !== "true") throw new ApiError(409, "Este material já tem um PDF. Reabra o material para substituí-lo.");
      await tx.insert(materialFiles).values({ materialId: id, filename: file.name.slice(0, 160), data })
        .onConflictDoUpdate({ target: materialFiles.materialId, set: { filename: file.name.slice(0, 160), data, createdAt: new Date() } });
      await audit(user.id, existing ? "material.pdf.replace" : "material.pdf.attach", id, tx);
    });
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}

export const GET = instrument("/api/materials/[id]/pdf", "GET", handleGET);

export const POST = instrument("/api/materials/[id]/pdf", "POST", handlePOST);
