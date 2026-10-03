"use client";

import { useMemo, useState } from "react";
import {
  CheckCheck,
  ClipboardPaste,
  PencilLine,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useApp, toast, refreshSubjectsEvent } from "@/components/AppShell";
import { api } from "@/lib/api";
import { EditableQuestion } from "@/components/EditableQuestion";
import { Button, Select, TextArea, Badge, Spinner } from "@/components/ui";
import { SUBJECT_COLORS } from "@/lib/constants";
import { SAMPLE_TEXT } from "@/lib/sample";
import type { ParsedQuestion } from "@/lib/types";

let manualSeq = 0;
function emptyQuestion(): ParsedQuestion {
  manualSeq += 1;
  return {
    tempId: `m${manualSeq}-${Math.random().toString(36).slice(2, 7)}`,
    statement: "",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" },
    ],
    correctKey: null,
    feedback: "",
    warnings: [],
  };
}

export default function ImportarPage() {
  const { user, subjects, refreshSubjects } = useApp();

  const [tab, setTab] = useState<"paste" | "manual">("paste");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [creating, setCreating] = useState(subjects.length === 0);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);

  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuestion[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const [manual, setManual] = useState<ParsedQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId],
  );

  const withAnswer = parsed?.filter((q) => q.correctKey).length ?? 0;

  if (!user.isAdmin) {
    return <div className="card p-6"><h1 className="font-display text-2xl font-semibold">Conteúdo administrado</h1><p className="mt-2 text-ink-soft">Apenas o administrador pode adicionar ou alterar questões e materiais. Você já pode estudar o conteúdo disponível.</p></div>;
  }

  async function createSubject() {
    if (newName.trim().length < 2) {
      toast("Dê um nome com pelo menos 2 letras para a matéria.", "err");
      return;
    }
    const s = await api<{ id: string }>(
      "/api/subjects",
      {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      },
    ).catch(() => null);
    if (s) {
      toast("Matéria criada!");
      setNewName("");
      setCreating(false);
      refreshSubjects();
      refreshSubjectsEvent();
      setTimeout(() => setSubjectId(s.id), 50);
      refreshSubjects();
    }
  }

  async function analyze() {
    if (!text.trim()) {
      toast("Cole o texto da revisão primeiro.", "err");
      return;
    }
    setAnalyzing(true);
    setParseErrors([]);
    setParsed(null);
    try {
      const res = await api<{ questions: ParsedQuestion[]; errors: string[] }>(
        "/api/parse",
        { method: "POST", body: JSON.stringify({ text }) },
      );
      setParsed(res.questions);
      setParseErrors(res.errors);
      if (res.questions.length > 0) {
        toast(
          `${res.questions.length} quest${res.questions.length === 1 ? "ão detectada" : "ões detectadas"} — confira e salve.`,
        );
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao analisar o texto.", "err");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveQuestions(list: ParsedQuestion[]) {
    if (!subjectId) {
      toast("Escolha (ou crie) a matéria de destino primeiro.", "err");
      return;
    }
    const valid = list.filter(
      (q) => q.statement.trim().length >= 8 && q.options.filter((o) => o.text.trim()).length >= 2,
    );
    if (valid.length === 0) {
      toast("Nenhuma questão válida. Preencha enunciado e pelo menos 2 alternativas.", "err");
      return;
    }
    const pending = valid.filter((q) => !q.correctKey).length;
    if (pending > 0 && !window.confirm(`${pending} questão(ões) sem gabarito não entrarão na prova. Deseja salvá-las como pendentes? Você pode completar o gabarito no banco depois.`)) return;
    setSaving(true);
    try {
      const res = await api<{ inserted: number; skipped: number }>(
        "/api/questions/bulk",
        {
          method: "POST",
          body: JSON.stringify({ subjectId, skipDuplicates: true, questions: valid }),
        },
      );
      toast(
        `${res.inserted} quest${res.inserted === 1 ? "ão salva" : "ões salvas"}${
          res.skipped > 0 ? ` · ${res.skipped} duplicada${res.skipped === 1 ? "" : "s"} pulada${res.skipped === 1 ? "" : "s"}` : ""
        }`,
      );
      refreshSubjects();
      refreshSubjectsEvent();
      if (tab === "paste") {
        setText("");
        setParsed(null);
      } else {
        setManual([emptyQuestion()]);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Importar questões</h1>
        <p className="mt-2 text-ink-soft max-w-2xl">
          Copie o texto da tela de revisão da plataforma da faculdade, cole aqui e o
          motor de análise monta tudo sozinho: enunciado, alternativas, gabarito e
          explicação.
        </p>
      </div>

      {/* abas */}
      <div className="flex gap-1.5 bg-ink/5 rounded-xl p-1.5 w-fit">
        {(
          [
            { id: "paste", label: "Colar da revisão", icon: ClipboardPaste },
            { id: "manual", label: "Criar manualmente", icon: PencilLine },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              tab === t.id ? "bg-card shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* matéria de destino */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-brand-deep" />
          <p className="text-sm font-semibold">Salvar na matéria</p>
          {activeSubject && (
            <Badge tone="neutral">
              <span className="w-2 h-2 rounded-full" style={{ background: activeSubject.color }} />
              {activeSubject.name}
            </Badge>
          )}
        </div>
        {creating || subjectId === "__new" ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da nova matéria (ex.: Ética)"
              className="flex-1 min-w-52 h-11 px-3.5 rounded-xl border border-line bg-card text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/10"
            />
            <div className="flex items-center gap-1.5">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    newColor === c ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`cor ${c}`}
                />
              ))}
            </div>
            <Button onClick={createSubject}>Criar matéria</Button>
            {!creating && subjects.length > 0 && (
              <Button variant="ghost" onClick={() => setSubjectId(subjects[0]?.id ?? "")}>
                Escolher existente
              </Button>
            )}
          </div>
        ) : (
          <div className="max-w-md">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.questionCount})
                </option>
              ))}
              <option value="__new">+ Nova matéria…</option>
            </Select>
          </div>
        )}
      </div>

      {tab === "paste" ? (
        <div className="space-y-6">
          {/* área de colagem */}
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold">1 · Cole o texto da revisão</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE_TEXT)}>
                  Usar texto de exemplo
                </Button>
                {text && (
                  <Button variant="ghost" size="sm" onClick={() => setText("")}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            <TextArea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Cole aqui tudo que você copiou da área de revisão — incluindo 'Questão 1', as alternativas A. a E., o feedback e a linha 'A resposta correta é: …'."}
              className="mt-3 leading-relaxed"
            />
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted">
                {text.length.toLocaleString("pt-BR")} caracteres · até 300 mil por vez
              </p>
              <Button onClick={analyze} disabled={analyzing || !text.trim()}>
                {analyzing ? (
                  <>
                    <Spinner size={16} /> Analisando…
                  </>
                ) : (
                  <>
                    <Wand2 size={16} /> Analisar questões
                  </>
                )}
              </Button>
            </div>
          </div>

          {parseErrors.map((e, i) => (
            <div key={i} className="card p-4 border-red/30 bg-red-soft/60">
              <p className="text-sm font-semibold text-red">{e}</p>
            </div>
          ))}

          {/* preview */}
          {parsed && parsed.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="font-display text-xl font-semibold">2 · Confira o que foi detectado</p>
                <Badge tone="brand">{parsed.length} quest{parsed.length === 1 ? "ão" : "ões"}</Badge>
                <Badge tone="green">
                  <CheckCheck size={12} /> {withAnswer} com gabarito identificado
                </Badge>
              </div>
              {parsed.map((q, i) => (
                <EditableQuestion
                  key={q.tempId}
                  q={q}
                  index={i + 1}
                  onChange={(nq) => setParsed(parsed.map((x) => (x.tempId === nq.tempId ? nq : x)))}
                  onDelete={() => setParsed(parsed.filter((x) => x.tempId !== q.tempId))}
                />
              ))}
              <div className="flex justify-end">
                <Button size="lg" onClick={() => saveQuestions(parsed)} disabled={saving}>
                  {saving ? "Salvando…" : (
                    <>
                      <Save size={17} /> Salvar no banco ({parsed.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted -mt-2">
            Prefere digitar? Monte a questão na mão e salve direto no banco.
          </p>
          {manual.map((q, i) => (
            <EditableQuestion
              key={q.tempId}
              q={q}
              index={i + 1}
              onChange={(nq) => setManual(manual.map((x) => (x.tempId === nq.tempId ? nq : x)))}
              onDelete={() =>
                manual.length > 1 ? setManual(manual.filter((x) => x.tempId !== q.tempId)) : undefined
              }
            />
          ))}
          <div className="flex justify-between flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setManual([...manual, emptyQuestion()])}>
              + Adicionar outra questão
            </Button>
            <Button size="lg" onClick={() => saveQuestions(manual)} disabled={saving}>
              {saving ? "Salvando…" : (
                <>
                  <Save size={17} /> Salvar no banco ({manual.length})
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
