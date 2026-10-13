"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, useApp } from "@/components/AppShell";
import { api } from "@/lib/api";
import type { AnswerRecord, QuizQuestion } from "@/lib/types";
type Stage = "setup" | "run" | "done";

export function useQuizSession() {
  const { user, subjects } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [stage, setStage] = useState<Stage>("setup");
  const [subjectId, setSubjectId] = useState(searchParams.get("m") ?? subjects[0]?.id ?? "");
  const [count, setCount] = useState("10");
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

  return { user, subjects, router, stage, setStage, subjectId, setSubjectId, count, setCount, onlyWrong, setOnlyWrong, source, setSource, loading, emptyMsg, quiz, subjectName, index, selected, setSelected, checked, answers, elapsed, saving, restored, effectiveSubjectId, subject, start, check, next };
}
