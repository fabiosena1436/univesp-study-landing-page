"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  Play,
  RotateCcw,
  Timer,
  XCircle,
} from "lucide-react";
import { toast, useApp } from "@/components/AppShell";
import { api, formatDuration } from "@/lib/api";
import { Badge, Button, ScoreRing, Select, Spinner, ToggleRow } from "@/components/ui";
import type { AnswerRecord, QuizQuestion } from "@/lib/types";

type Stage = "setup" | "run" | "done";

export default function ProvaPage() {
  return (
    <Suspense fallback={null}>
      <ProvaInner />
    </Suspense>
  );
}

function ProvaInner() {
  const { user, subjects } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>("setup");
  const [subjectId, setSubjectId] = useState(searchParams.get("m") ?? subjects[0]?.id ?? "");
  const [count, setCount] = useState("10");
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [source, setSource] = useState<"all" | "revisao" | "material">("all");
  const [loading, setLoading] = useState(false);
  const [emptyMsg, setEmptyMsg] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const [submissionId, setSubmissionId] = useState("");
  const [restored, setRestored] = useState(false);
  const saveLock = useRef(false);
  const storageKey = "aprova:quiz:v1:" + user.id;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.version === 1 && draft.quiz?.length && draft.startedAt > Date.now() - 86400000 && draft.index >= 0 && draft.index < draft.quiz.length) {
          setQuiz(draft.quiz); setSubjectId(draft.subjectId); setSubjectName(draft.subjectName); setIndex(draft.index);
          setSelected(draft.selected); setChecked(draft.checked); setAnswers(draft.answers); setStartedAt(draft.startedAt);
          setSubmissionId(draft.submissionId); setStage("run");
        } else sessionStorage.removeItem(storageKey);
      }
    } catch { try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ } }
    setRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  useEffect(() => {
    if (!restored || stage !== "run") return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, quiz, subjectId, subjectName, index, selected, checked, answers, startedAt, submissionId })); }
    catch { /* Browsers can disable storage; the current session still works. */ }
  }, [restored, stage, storageKey, quiz, subjectId, subjectName, index, selected, checked, answers, startedAt, submissionId]);
  useEffect(() => {
    if (stage !== "run") return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [stage]);
  const effectiveSubjectId = subjectId || subjects[0]?.id || "";
  const subject = subjects.find((s) => s.id === effectiveSubjectId);

  useEffect(() => {
    if (stage !== "run") return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [stage, startedAt]);

  async function start() {
    if (!effectiveSubjectId) return;
    setLoading(true);
    setEmptyMsg(null);
    try {
      const res = await api<{
        questions: QuizQuestion[];
        subjectName: string;
        emptyMessage: string | null;
      }>(
        "/api/quiz",
        {
        method: "POST",
        body: JSON.stringify({
          subjectId: effectiveSubjectId,
          count: count === "all" ? 200 : Number(count),
          shuffleOptions,
          onlyWrong,
          source,
        }),
      });
      if (res.questions.length === 0) {
        setEmptyMsg(res.emptyMessage ?? "Sem questões para essa configuração.");
        return;
      }
      setSubjectId(effectiveSubjectId);
      setSubmissionId(crypto.randomUUID());
      setQuiz(res.questions);
      setSubjectName(res.subjectName);
      setIndex(0);
      setAnswers([]);
      setSelected(null);
      setChecked(false);
      setStartedAt(Date.now());
      setElapsed(0);
      setStage("run");
    } catch (e) {
      setEmptyMsg(e instanceof Error ? e.message : "Falha ao gerar a prova.");
    } finally {
      setLoading(false);
    }
  }

  function check() {
    const q = quiz[index];
    if (!selected || checked) return;
    const isCorrect = selected === q.correctKey;
    setAnswers((a) => [...a, { questionId: q.id, selectedKey: selected, isCorrect }]);
    setChecked(true);
  }

  async function finish() {
    if (saveLock.current) return;
    saveLock.current = true; setSaving(true);
    try {
      const result = await api<{ correctCount: number; answers: AnswerRecord[] }>("/api/attempts", { method: "POST", body: JSON.stringify({ subjectId, submissionId, durationSec: Math.floor((Date.now() - startedAt) / 1000), answers: answers.map(({ questionId, selectedKey }) => ({ questionId, selectedKey })) }) });
      setAnswers(result.answers);
      try { sessionStorage.removeItem(storageKey); } catch { /* Saving succeeded even if storage is unavailable. */ }
      toast("Prova salva: " + result.correctCount + " acertos."); setStage("done");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível salvar. Seu treino continua disponível para tentar novamente.", "err"); }
    finally { saveLock.current = false; setSaving(false); }
  }

  function next() {
    if (index + 1 < quiz.length) {
      setIndex((i) => i + 1);
      setSelected(null);
      setChecked(false);
    } else {
      finish();
    }
  }

  if (!restored) return <p role="status">Restaurando seu treino…</p>;

  /* ------------------------------ SETUP ------------------------------ */
  if (stage === "setup") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="anim-fade-up">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Gerar prova</h1>
          <p className="mt-2 text-ink-soft">
            Escolha a matéria e a quantidade — o resto a gente monta.
          </p>
        </div>

        <div className="card p-6 space-y-5 anim-fade-up">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Matéria</label>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted">
                Você ainda não tem matérias.{" "}
                <button className="text-pen font-semibold hover:underline cursor-pointer" onClick={() => router.push("/app/contato")}>
                  Aguarde a publicação de questões
                </button>
                .
              </p>
            ) : (
              <Select aria-label="Matéria da prova" value={effectiveSubjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.questionCount} quest.
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Quantas questões?</label>
            <div className="flex gap-2 flex-wrap">
              {["5", "10", "15", "20", "all"].map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    count === c
                      ? "bg-ink text-paper border-ink"
                      : "bg-card border-line hover:border-line-strong"
                  }`}
                >
                  {c === "all" ? "Até 200" : c}
                </button>
              ))}
            </div>
            {subject && subject.questionCount > 0 && (
              <p className="text-xs text-muted mt-1.5">
                {subject.name} tem {subject.questionCount} questões no banco{subject.readyQuestionCount !== undefined ? `; ${subject.readyQuestionCount} com gabarito disponíveis para prova antes dos filtros.` : "."}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Origem das questões</label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "revisao", label: "Da revisão" },
                  { id: "material", label: "Do material/PDF" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSource(o.id)}
                  className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                    source === o.id
                      ? "bg-ink text-paper border-ink"
                      : "bg-card border-line hover:border-line-strong"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <ToggleRow
              label="Embaralhar a ordem das alternativas"
              hint="A letra certa muda de lugar a cada prova"
              checked={shuffleOptions}
              onChange={setShuffleOptions}
            />
            <ToggleRow
              label="Só as questões que eu já errei"
              hint="Modo revisão: foca no que ainda te pega"
              checked={onlyWrong}
              onChange={setOnlyWrong}
            />
          </div>

          {emptyMsg && (
            <div role="alert" className="text-sm font-semibold text-red bg-red-soft border border-red/20 rounded-xl px-3.5 py-2.5">
              <p>{emptyMsg}</p>
              <button className="mt-2 underline cursor-pointer" onClick={() => router.push(`/app/questoes?m=${effectiveSubjectId}`)}>{user.isAdmin ? "Abrir banco e completar gabaritos" : "Consultar banco de questões"}</button>
            </div>
          )}

          <Button size="lg" className="w-full" onClick={start} disabled={loading || subjects.length === 0}>
            {loading ? (
              <>
                <Spinner size={17} /> Montando a prova…
              </>
            ) : (
              <>
                <Play size={17} /> Começar prova
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------- RUN -------------------------------- */
  if (stage === "run") {
    const q = quiz[index];
    const scoreSoFar = answers.filter((a) => a.isCorrect).length;
    const isCorrect = selected === q.correctKey;
    const correctOption = q.options.find((o) => o.key === q.correctKey);
    const selectedOption = q.options.find((o) => o.key === selected);

    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {/* barra superior */}
        <div className="card px-5 py-3.5 flex items-center gap-4 anim-fade-up">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-muted mb-1.5">
              <span className="truncate text-ink">{subjectName}</span>
              <span className="tabular-nums">
                {index + 1} / {quiz.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink/8 overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: `${((index + (checked ? 1 : 0)) / quiz.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
            <Timer size={15} className="text-muted" />
            {formatDuration(elapsed)}
          </div>
          <Badge tone={scoreSoFar > 0 ? "green" : "neutral"}>{scoreSoFar} acerto{scoreSoFar === 1 ? "" : "s"}</Badge>
        </div>

        {/* questão */}
        <div className="card p-6 anim-pop" key={q.id}>
          <p className="whitespace-pre-line leading-relaxed text-[15px]">{q.statement}</p>

          <div className="mt-5 space-y-2.5">
            {q.options.map((o) => {
              const isSel = selected === o.key;
              let style = "border-line bg-surface hover:border-line-strong";
              if (checked) {
                if (o.key === q.correctKey) style = "border-green/50 bg-green-soft";
                else if (isSel) style = "border-red/50 bg-red-soft";
                else style = "border-line bg-surface opacity-60";
              } else if (isSel) {
                style = "border-ink bg-brand-soft/60";
              }
              return (
                <button
                  key={o.key}
                  disabled={checked}
                  aria-pressed={selected === o.key} onClick={() => setSelected(o.key)}
                  className={`w-full flex items-start gap-3.5 rounded-xl border px-4 py-3 text-sm text-left transition-all cursor-pointer disabled:cursor-default ${style}`}
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center text-sm font-bold border ${
                      checked && o.key === q.correctKey
                        ? "bg-green text-white border-green"
                        : checked && isSel
                          ? "bg-red text-white border-red"
                          : isSel
                            ? "bg-ink text-paper border-ink"
                            : "bg-card border-line-strong"
                    }`}
                  >
                    {o.key}
                  </span>
                  <span className="whitespace-pre-line leading-relaxed pt-1 flex-1">{o.text}</span>
                  {checked && o.key === q.correctKey && (
                    <CheckCircle2 size={19} className="text-green shrink-0 mt-1" />
                  )}
                  {checked && isSel && o.key !== q.correctKey && (
                    <XCircle size={19} className="text-red shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* feedback */}
          {checked && (
            <div
              className={`mt-5 rounded-xl border px-4 py-3.5 anim-fade-up ${
                isCorrect ? "border-green/30 bg-green-soft" : "border-red/30 bg-red-soft"
              }`}
            >
              <p className={`text-sm font-bold flex items-center gap-2 ${isCorrect ? "text-green" : "text-red"}`}>
                {isCorrect ? (
                  <>
                  <CheckCircle2 size={16} /> Você acertou!
                  </>
                ) : selected ? (
                  <>
                  <XCircle size={16} /> Você errou
                  </>
                ) : (
                  <>
                    <XCircle size={16} /> Deixou em branco
                  </>
                )}
              </p>
              {selectedOption && !isCorrect && (
                <p className="mt-1.5 text-sm text-ink-soft">
                Você marcou <strong>{selectedOption.key}</strong>. A resposta correta é{" "}
                <strong>{correctOption ? `${correctOption.key} — ${correctOption.text}` : q.correctKey}</strong>.
                </p>
              )}
              {isCorrect && (
                <p className="mt-1.5 text-sm text-ink-soft">
                Muito bem! Agora confira a explicação para fixar o conteúdo.
                </p>
              )}
              {q.feedback ? (
                <div className="mt-3 border-t border-current/10 pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">
                  Explicação para aprender
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{q.feedback}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">
                Esta questão não veio com uma explicação detalhada.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ações */}
        <div className="flex items-center justify-between gap-3">
          {!checked ? (
            <>
              <Button variant="ghost" onClick={next} title="Pular e contar como erro">
                Deixar em branco
              </Button>
              <Button size="lg" onClick={check} disabled={!selected}>
                Verificar resposta
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted">
                {index + 1 === quiz.length ? "Última questão!" : `Faltam ${quiz.length - index - 1} quest${quiz.length - index - 1 === 1 ? "ão" : "ões"}`}
              </span>
              <Button size="lg" onClick={next} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size={16} /> Salvando…
                  </>
                ) : index + 1 === quiz.length ? (
                  <>
                    <Flag size={16} /> Finalizar prova
                  </>
                ) : (
                  <>
                    Próxima <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ DONE -------------------------------- */
  const correctCount = answers.filter((a) => a.isCorrect).length;
  const pct = quiz.length > 0 ? Math.round((correctCount / quiz.length) * 100) : 0;
  const wrong = answers.filter((a) => !a.isCorrect);
  const message =
    pct >= 90
      ? "Nível professor. Só manter assim até o dia da prova."
      : pct >= 70
        ? "Muito bom! Dá para subir mais um pouco."
        : pct >= 40
          ? "Você está no caminho — repita as que errou."
          : "Bora revisar as explicações e tentar de novo. Vai entrar.";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-8 text-center anim-pop">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">
          {subjectName} · {formatDuration(elapsed)}
        </p>
        <div className="mt-5 flex justify-center">
          <ScoreRing pct={pct}>
            <div>
              <p className="font-display text-4xl font-semibold tabular-nums">{pct}%</p>
              <p className="text-xs text-muted mt-0.5">
                {correctCount} de {quiz.length}
              </p>
            </div>
          </ScoreRing>
        </div>
        <p className="mt-5 text-lg font-semibold">{message}</p>
        {wrong.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            {wrong.length} quest{wrong.length === 1 ? "ão" : "ões"} para revisar.
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {wrong.length > 0 && (
            <Button
              variant="brand"
              onClick={() => {
                setOnlyWrong(true);
                setStage("setup");
              }}
            >
              <RotateCcw size={16} /> Repetir as que errei
            </Button>
          )}
          <Button variant="ghost" onClick={() => setStage("setup")}>
            Nova prova
          </Button>
          <Button variant="soft" onClick={() => router.push(`/app/questoes?m=${subjectId}`)}>
            Ver no banco
          </Button>
        </div>
      </div>

      {wrong.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">O que revisar</h2>
          <div className="space-y-2.5">
            {wrong.map((a, i) => {
              const q = quiz.find((x) => x.id === a.questionId);
              if (!q) return null;
              const chosen = q.options.find((o) => o.key === a.selectedKey);
              const correct = q.options.find((o) => o.key === q.correctKey);
              return (
                <div key={i} className="card p-4 anim-fade-up">
                  <p className="text-sm leading-relaxed line-clamp-2">
                    <span className="font-bold mr-2">{i + 1}.</span>
                    {q.statement}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                    <Badge tone={a.selectedKey ? "red" : "neutral"}>
                      Você: {a.selectedKey ? `${a.selectedKey} · ${chosen?.text.slice(0, 48)}…` : "em branco"}
                    </Badge>
                    {q.correctKey && (
                      <Badge tone="green">{q.correctKey} · {correct?.text.slice(0, 48)}…</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
