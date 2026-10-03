"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpenText,
  CheckCheck,
  FileText,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { refreshSubjectsEvent, toast, useApp } from "@/components/AppShell";
import { api, formatDate } from "@/lib/api";
import { EditableQuestion } from "@/components/EditableQuestion";
import { Badge, Button, EmptyState, Input, Select, Spinner, TextArea } from "@/components/ui";
import { SAMPLE_TEXT } from "@/lib/sample";
import type { GenerateResponse, MaterialDetail, MaterialRow, ParsedQuestion } from "@/lib/types";

export default function MateriaisPage() {
  const { user, subjects, refreshSubjects } = useApp();

  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [list, setList] = useState<MaterialRow[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [uploading, setUploading] = useState(false);
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
    loadList();
    api<{ engine: "gemini" | "local" }>("/api/ai-engine")
      .then((d) => setEngine(d.engine))
      .catch(() => setEngine("local"));
  }, [loadList]);

  if (!user.isAdmin) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-semibold">Área administrativa</h1>
        <p className="mt-2 text-ink-soft">
          Materiais, geração por IA e cadastro de questões são gerenciados somente pelo administrador.
        </p>
      </div>
    );
  }

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
    try {
      const d = await api<MaterialDetail>(`/api/materials/${res.id}`);
      setActive(d);
      setGenerated([]);
      setGenNote(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "O material foi salvo, mas não foi possível abrir seu conteúdo.", "err");
    }
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
      if (goQuiz) window.location.href = `/app/prova?m=${active.subjectId}`;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeMaterial(id: string) {
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

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Importar revisão</h1>
        <p className="mt-2 text-ink-soft max-w-2xl">
          Envie texto ou PDF para extrair questões existentes. Com IA configurada,
          você também pode criar rascunhos com trecho de origem para revisão antes de publicar.
        </p>
      </div>

      {/* motor */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand border border-ink/10 grid place-items-center shrink-0">
          <Sparkles size={17} />
        </span>
        <div className="flex-1 min-w-52">
          <p className="text-sm font-semibold">
            {engine === "gemini" ? "IA configurada (Gemini)" : "Extração de questões existentes"}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {engine === "gemini"
              ? "A IA avalia e organiza a revisão colada antes de criar novas questões."
              : "A importação estruturada funciona sem IA. Configure GEMINI_API_KEY para gerar questões novas a partir de textos de aula."}
          </p>
        </div>
        <Badge tone={engine === "gemini" ? "pen" : "brand"}>
          {engine === "gemini" ? "IA ativa" : "extração local"}
        </Badge>
      </div>

      {/* matéria de destino */}
      <div className="card p-5">
        <p className="text-sm font-semibold mb-3">Matéria do material</p>
        {subjects.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Nome da matéria (ex.: Ética)"
              className="max-w-xs"
            />
            <Button variant="ghost" onClick={() => ensureSubject()}>
              Criar matéria
            </Button>
          </div>
        ) : (
          <div className="max-w-md">
            <Select value={targetSubject} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.questionCount} quest.)
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* fonte do material */}
      <div className="card p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="w-9 h-9 rounded-xl bg-pen-soft text-pen grid place-items-center">
            <BookOpenText size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold">Colar revisão</p>
            <p className="text-xs text-muted">Use texto corrido, resumo, apostila ou revisão copiada.</p>
          </div>
        </div>

        <div className="space-y-3">
            <Input
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="Título do material (ex.: Aula 4 — Ética normativa)"
            />
            <TextArea
              rows={7}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Cole aqui o conteúdo da aula, slides, resumo…"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted">
                {pasteText.length.toLocaleString("pt-BR")} caracteres
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPasteText(SAMPLE_TEXT)}>
                  Usar exemplo
                </Button>
                <Button onClick={uploadText} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Spinner size={16} /> Salvando…
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Salvar revisão
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

      </div>

      {/* material ativo + geração */}
      {active && (
        <div className="card p-5 anim-fade-up">
          <div className="flex items-start gap-3 flex-wrap">
            <span className="w-10 h-10 rounded-xl bg-pen-soft text-pen grid place-items-center shrink-0">
              <FileText size={18} />
            </span>
            <div className="flex-1 min-w-48">
              <h3 className="font-semibold">{active.title}</h3>
              <p className="text-xs text-muted mt-0.5">
                {active.charCount.toLocaleString("pt-BR")} caracteres
                {active.pageCount > 0 ? ` · ${active.pageCount} pág.` : ""} · lido com sucesso
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowContent((v) => !v)}>
              {showContent ? "Esconder conteúdo" : "Ler conteúdo"}
            </Button>
          </div>

          {showContent && (
            <div className="mt-4 rounded-xl bg-surface border border-line p-4 max-h-72 overflow-y-auto">
              <p className="text-sm whitespace-pre-line leading-relaxed">{active.content}</p>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-line flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                Quantas questões gerar
              </p>
              <div className="flex gap-2">
                {["5", "10", "15", "20"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setGenCount(c)}
                    className={`h-10 w-14 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                      genCount === c
                        ? "bg-ink text-paper border-ink"
                        : "bg-card border-line hover:border-line-strong"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <Button className="ml-auto" onClick={generate} disabled={generating}>
              {generating ? (
                <>
                  <Spinner size={16} /> Criando questões…
                </>
              ) : (
                <>
                  <Wand2 size={16} /> Gerar questões com IA
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {genNote && (
        <div className="card p-4 bg-brand-soft/60 border-brand/40">
          <p className="text-sm text-ink-soft leading-relaxed">{genNote}</p>
        </div>
      )}

      {/* preview das geradas */}
      {generated.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="font-display text-xl font-semibold">Confira as questões geradas</p>
            <Badge tone="brand">{generated.length} quest.</Badge>
            <Badge tone="green">
              <CheckCheck size={12} /> {withAnswer} com gabarito
            </Badge>
          </div>
          {generated.map((q, i) => (
            <EditableQuestion
              key={q.tempId}
              q={q}
              index={i + 1}
              onChange={(nq) => setGenerated(generated.map((x) => (x.tempId === nq.tempId ? nq : x)))}
              onDelete={() => setGenerated(generated.filter((x) => x.tempId !== q.tempId))}
            />
          ))}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setGenerated([])} disabled={saving}>
              Descartar
            </Button>
            <Button variant="ghost" onClick={() => saveGenerated(false)} disabled={saving}>
              {saving ? "Salvando…" : <><Save size={16} /> Salvar no banco</>}
            </Button>
            <Button onClick={() => saveGenerated(true)} disabled={saving}>
              {saving ? "Salvando…" : <><Wand2 size={16} /> Salvar e fazer a prova</>}
            </Button>
          </div>
        </div>
      )}

      {/* lista de materiais */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Seus materiais</h2>
        {error ? <p role="alert" className="text-red">{error}</p> : list === null ? (
          <div className="card p-8 grid place-items-center text-muted">
            <Spinner size={22} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="Nenhum material ainda"
            desc="Cole uma revisão com perguntas e alternativas acima para salvar e analisar."
          />
        ) : (
          <div className="card divide-y divide-line">
            {error && <p role="alert" className="text-red">{error}</p>}
            {list.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <span className="w-10 h-10 rounded-xl bg-brand border border-ink/10 grid place-items-center shrink-0">
                  <FileText size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-xs text-muted truncate">
                    {m.subjectName} · {m.charCount.toLocaleString("pt-BR")} car.
                    {m.pageCount > 0 ? ` · ${m.pageCount} pág.` : ""} · {m.questionCount} quest.
                    {" · "}
                    {formatDate(m.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={async () => {
                    try {
                    const d = await api<MaterialDetail>(`/api/materials/${m.id}`);
                    setActive(d);
                    setGenerated([]);
                    setGenNote(null);
                    setShowContent(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível abrir o material.", "err"); }
                  }}
                >
                  Gerar questões
                </Button>
                <button
                  onClick={() => removeMaterial(m.id)}
                  title="Arquivar material e suas questões"
                  className="p-2 rounded-lg text-muted hover:text-red hover:bg-red-soft transition-colors cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {list !== null && (page > 0 || list.length >= 50) && <div className="flex gap-3 items-center mt-3"><Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="ghost" disabled={list.length < 50} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div>}
      </section>
    </div>
  );
}
