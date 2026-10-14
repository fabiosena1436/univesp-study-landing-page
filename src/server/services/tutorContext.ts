import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { materials, questions, subjects } from "@/db/schema";
import { ApiError } from "@/lib/errors";

export type TutorScope = { subjectId: string; materialId?: string; questionId?: string };

function relevantExcerpt(content: string, question: string, limit = 6500) {
  if (content.length <= limit) return content;
  const words = [...new Set((question.toLocaleLowerCase("pt-BR").match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(word => !["qual", "como", "para", "sobre", "pode", "explique", "material"].includes(word)))];
  const chunks = content.match(/[\s\S]{1,1100}/g) ?? [];
  const ranked = chunks.map((text, index) => ({ text, index, score: words.reduce((score, word) => score + (text.toLocaleLowerCase("pt-BR").includes(word) ? 1 : 0), 0) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, 5).sort((a, b) => a.index - b.index).map(item => item.text).join("\n[…]\n").slice(0, limit);
}

export async function tutorContext(scope: TutorScope, question: string) {
  const subject = (await db.select({ id: subjects.id, name: subjects.name }).from(subjects)
    .where(and(eq(subjects.id, scope.subjectId), isNull(subjects.archivedAt))).limit(1))[0];
  if (!subject) throw new ApiError(404, "Matéria não encontrada.");

  let materialId = scope.materialId;
  let statement = "";
  let sourceExcerpt = "";
  if (scope.questionId) {
    const row = (await db.select({ statement: questions.statement, sourceExcerpt: questions.sourceExcerpt, materialId: questions.materialId })
      .from(questions).where(and(eq(questions.id, scope.questionId), eq(questions.subjectId, subject.id), isNull(questions.archivedAt))).limit(1))[0];
    if (!row) throw new ApiError(404, "Questão não encontrada nesta matéria.");
    if (materialId && row.materialId && row.materialId !== materialId) throw new ApiError(400, "O material não corresponde à questão.");
    materialId ??= row.materialId ?? undefined;
    statement = row.statement.slice(0, 3500);
    sourceExcerpt = row.sourceExcerpt?.slice(0, 1500) ?? "";
  }

  let materialTitle = "";
  let materialContent = "";
  if (materialId) {
    const row = (await db.select({ title: materials.title, content: materials.content }).from(materials)
      .where(and(eq(materials.id, materialId), eq(materials.subjectId, subject.id), isNull(materials.archivedAt))).limit(1))[0];
    if (!row) throw new ApiError(404, "Material não encontrado nesta matéria.");
    materialTitle = row.title;
    // A generic request such as "dê uma dica" has no useful retrieval terms.
    // During a quiz, anchor retrieval to the actual question and its reference.
    materialContent = relevantExcerpt(row.content, [statement, sourceExcerpt, question].filter(Boolean).join(" "));
  } else if (!scope.questionId) {
    const rows = await db.select({ title: materials.title, content: sql<string>`left(${materials.content}, 1800)` })
      .from(materials).where(and(eq(materials.subjectId, subject.id), isNull(materials.archivedAt)))
      .orderBy(desc(materials.createdAt)).limit(3);
    materialContent = rows.filter(row => row.content.trim()).map(row => `${row.title}: ${row.content}`).join("\n\n").slice(0, 5500);
  }

  const hasReference = Boolean(sourceExcerpt || materialContent.trim());
  const context = [
    `Matéria: ${subject.name}`,
    statement && `Enunciado da questão (sem alternativas ou gabarito): ${statement}`,
    sourceExcerpt && `Trecho associado à questão: ${sourceExcerpt}`,
    materialTitle && `Material: ${materialTitle}`,
    materialContent && `Trechos do material: ${materialContent}`,
  ].filter(Boolean).join("\n\n");
  return { subjectName: subject.name, materialTitle, hasReference, context, isQuestion: Boolean(scope.questionId) };
}
