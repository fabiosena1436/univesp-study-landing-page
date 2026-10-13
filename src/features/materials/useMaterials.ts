"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshSubjectsEvent, toast, useApp } from "@/components/AppShell";
import { api } from "@/lib/api";
import { pdfValidationError } from "@/lib/pdfValidation";
import type { GenerateResponse, MaterialDetail, MaterialRow, ParsedQuestion } from "@/lib/types";

export function useMaterials() {
  const router = useRouter();
  const { user, subjects, refreshSubjects } = useApp();
  const canManage = Boolean(user.isAdmin || user.isAssistant);

  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [list, setList] = useState<MaterialRow[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileRevision, setFileRevision] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");

  const [active, setActive] = useState<MaterialDetail | null>(null);
  const [engine, setEngine] = useState<"gemini" | "local" | null>(null);
  const [genCount, setGenCount] = useState("10");
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<string | null>(null);
  const [generated, setGenerated] = useState<ParsedQuestion[]>([]);
  const [showContent, setShowContent] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(() => {
    api<MaterialRow[]>(`/api/materials?limit=50&offset=${page * 50}`)
      .then((rows) => { setError(""); setList(rows); })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar os materiais."));
  }, [page]);

  useEffect(() => {
    if (!canManage) return;
    loadList();
    api<{ engine: "gemini" | "local" }>("/api/ai-engine")
      .then((d) => setEngine(d.engine))
      .catch(() => setEngine("local"));
  }, [loadList, canManage]);


  const targetSubject = subjectId || subjects[0]?.id || "";

  async function ensureSubject(): Promise<string | null> {
    if (targetSubject) return targetSubject;
    if (newSubject.trim().length < 2) {
      toast("Escolha ou crie uma matéria para o material.", "err");
      return null;
    }
    try {
      const s = await api<{ id: string }>("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name: newSubject.trim() }),
      });
      setNewSubject("");
      refreshSubjects();
      refreshSubjectsEvent();
      setSubjectId(s.id);
      return s.id;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar matéria.", "err");
      return null;
    }
  }

  async function afterUpload(res: { id: string; charCount: number; pageCount: number; title: string }) {
    toast(`Material salvo: ${res.charCount.toLocaleString("pt-BR")} caracteres lidos.`);
    loadList();
    setPasteText("");
    setPasteTitle("");
    setAttachment(null);
    setPdfFile(null);
    setFileRevision(value => value + 1);
    try {
      const d = await api<MaterialDetail>(`/api/materials/${res.id}`);
      setActive(d);
      setGenerated([]);
      setGenNote(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "O material foi salvo, mas não foi possível abrir seu conteúdo.", "err");
    }
  }

  async function uploadPdf() {
    if (uploading || !pdfFile) return;
    const bad = pdfValidationError(pdfFile.name, pdfFile.type, pdfFile.size);
    if (bad) { toast(bad, "err"); return; }
    setUploading(true);
    try {
      const sid = await ensureSubject();
      if (!sid) return;
      const form = new FormData();
      form.set("subjectId", sid); form.set("title", pasteTitle); form.set("file", pdfFile);
      const res = await api<{ id: string; charCount: number; pageCount: number; title: string }>("/api/materials", { method: "POST", body: form });
      await afterUpload(res);
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível enviar o PDF.", "err"); }
    finally { setUploading(false); }
  }

  async function attachPdf() {
    if (uploading || !active || !attachment) return;
    const bad = pdfValidationError(attachment.name, attachment.type, attachment.size);
    if (bad) { toast(bad, "err"); return; }
    if (active.hasPdf && !window.confirm("Substituir o PDF anexado? O texto e as questões serão preservados.")) return;
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", attachment); form.set("replace", String(active.hasPdf));
      await api(`/api/materials/${active.id}/pdf`, { method: "POST", body: form });
      setActive({ ...active, hasPdf: true }); setAttachment(null); setFileRevision(value => value + 1); loadList();
      toast("PDF anexado. Os alunos já podem visualizar o arquivo.");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível anexar o PDF.", "err"); }
    finally { setUploading(false); }
  }

  async function uploadText() {
    const sid = await ensureSubject();
    if (!sid) return;
    if (pasteText.trim().length < 400) {
      toast("Cole pelo menos um trecho maior do conteúdo (uns 400 caracteres).", "err");
      return;
    }
    setUploading(true);
    try {
      const res = await api<{ id: string; charCount: number; pageCount: number; title: string }>(
        "/api/materials",
        {
          method: "POST",
          body: JSON.stringify({
            subjectId: sid,
            text: pasteText,
            title: pasteTitle || "Material colado",
          }),
        },
      );
      await afterUpload(res);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar o material.", "err");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!active) return;
    setGenerating(true);
    setGenNote(null);
    setGenerated([]);
    try {
      const res = await api<GenerateResponse>(`/api/materials/${active.id}/generate`, {
        method: "POST",
        body: JSON.stringify({ count: Number(genCount) }),
      });
      setGenerated(res.questions);
      setEngine(res.engine);
      setGenNote(
        res.note ??
          (res.engine === "local"
            ? "Questões existentes extraídas do material. Revise antes de salvar."
            : "Gerado pela IA com o conteúdo da revisão. Revise antes de salvar."),
      );
      if (res.questions.length === 0) toast(res.note || "Não foram encontradas questões válidas nesse material.", "err");
      else toast(`${res.questions.length} questões geradas — confira antes de salvar.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao gerar questões.";
      setGenNote(message);
      toast(message, "err");
    } finally {
      setGenerating(false);
    }
  }

  async function saveGenerated(goQuiz: boolean) {
    if (!active || generated.length === 0) return;
    setSaving(true);
    try {
      const res = await api<{ inserted: number; skipped: number }>("/api/questions/bulk", {
        method: "POST",
        body: JSON.stringify({
          subjectId: active.subjectId,
          materialId: active.id,
          source: "material",
          skipDuplicates: true,
          questions: generated,
        }),
      });
      toast(`${res.inserted} questões salvas na matéria.`);
      setGenerated([]);
      loadList();
      refreshSubjects();
      refreshSubjectsEvent();
      if (goQuiz) router.push(`/app/prova?m=${active.subjectId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeMaterial(id: string) {
    if (!window.confirm("Excluir este material e todas as questões vinculadas a ele? O histórico das provas será preservado.")) return;
    try {
      await api(`/api/materials/${id}`, { method: "DELETE" });
      setList((l) => (l ? l.filter((m) => m.id !== id) : l));
      if (active?.id === id) {
        setActive(null);
        setGenerated([]);
      }
      refreshSubjects();
      refreshSubjectsEvent();
      toast("Material e suas questões foram arquivados. O histórico foi preservado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao remover.", "err");
    }
  }

  const withAnswer = generated.filter((q) => q.correctKey).length;

  return { user, subjects, canManage, page, setPage, error, list, setSubjectId, newSubject, setNewSubject, uploading, pdfFile, setPdfFile, attachment, setAttachment, fileRevision, pasteText, setPasteText, pasteTitle, setPasteTitle, active, setActive, engine, genCount, setGenCount, generating, genNote, setGenNote, generated, setGenerated, showContent, setShowContent, saving, loadList, targetSubject, ensureSubject, uploadPdf, attachPdf, uploadText, generate, saveGenerated, removeMaterial, withAnswer };
}
