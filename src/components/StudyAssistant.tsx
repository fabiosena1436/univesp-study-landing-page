"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BotMessageSquare, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Subject } from "@/lib/types";
import { Button, Select, Spinner, TextArea } from "@/components/ui";
import { AssistantAnswer } from "@/components/AssistantAnswer";
import { tutorPages, type TutorScope } from "@/lib/tutorScope";
import { TutorQuotaMeter } from "@/components/TutorQuotaMeter";

type Message = { role: "user" | "assistant"; text: string };
type TutorAnswer = { answer: string; hasReference: boolean; materialTitle: string };

export function StudyAssistant({ scope, subjectName, subjects, selectedSubjectId, onSubjectChange }: {
  scope: TutorScope | null;
  subjectName: string;
  subjects?: Subject[];
  selectedSubjectId: string;
  onSubjectChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quotaRevision, setQuotaRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      element.querySelector("textarea")?.focus();
    } else if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => () => request.current?.abort(), []);

  function changeSubject(id: string) {
    request.current?.abort();
    setMessages([]);
    setInput("");
    setError("");
    setBusy(false);
    onSubjectChange(id);
  }

  const suggestions = !scope?.subjectId
    ? ["Como usar esta página?", "Onde encontro os materiais e as provas?", "Como funciona a revisão?"]
    : scope.questionId
    ? ["Dê uma dica sem revelar a resposta", "Qual conceito preciso revisar?", "Explique o enunciado em outras palavras"]
    : scope?.materialId
      ? ["Resuma os pontos principais", "Explique o conceito mais importante", `O que revisar em ${subjectName}?`]
      : [`Como começar a estudar ${subjectName} aqui na plataforma?`, "Quais são os conceitos essenciais?", "Onde encontro os materiais e as provas?"];

  async function ask(text: string) {
    const question = text.trim();
    if (question.length < 3 || busy || !scope) return;
    const previous = messages.slice(-6).map(message => ({ ...message, text: message.text.slice(0, 1000) }));
    const controller = new AbortController();
    request.current = controller;
    setMessages([...messages, { role: "user", text: question }]);
    setInput("");
    setError("");
    setBusy(true);
    try {
      const result = await api<TutorAnswer>("/api/tutor", {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({ question, scope, history: previous }),
      });
      if (!controller.signal.aborted) setMessages(current => [...current, { role: "assistant", text: result.answer }]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível responder agora.");
    } finally {
      setQuotaRevision(value => value + 1);
      if (request.current === controller) request.current = null;
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Abrir assistente de IA"
      className="assistant-launch shrink-0 inline-flex items-center gap-2.5 rounded-[22px] border border-white/30 bg-gradient-to-br from-pen via-brand-deep to-[#34227e] p-1 xl:pr-4 text-left text-white shadow-xl shadow-pen/30 hover:shadow-2xl hover:shadow-pen/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen cursor-pointer">
      <span className="assistant-avatar relative grid size-9 xl:size-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
        <BotMessageSquare size={25} strokeWidth={1.9} aria-hidden="true" />
        <Sparkles size={13} className="assistant-spark absolute -right-1 -top-1 text-[#ffe58a]" aria-hidden="true" />
      </span>
      <span className="hidden xl:flex flex-col leading-tight"><strong className="text-sm">Assistente IA</strong><span className="mt-0.5 text-[11px] font-medium text-white/80">Tire sua dúvida</span></span>
    </button>
    <dialog ref={dialog} onClose={() => { request.current?.abort(); setOpen(false); }} aria-labelledby="assistant-title"
      className="fixed inset-x-3 bottom-3 top-auto z-50 m-0 hidden h-[min(680px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-line-strong bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/55 open:flex sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[430px]">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-brand-soft/60 px-4 py-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-pen text-white"><BotMessageSquare size={22} aria-hidden="true" /><Sparkles size={11} className="absolute -right-1 -top-1 text-brand-deep" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="assistant-title" className="font-semibold">Assistente de estudos</h2>
          <p className="truncate text-xs text-ink-soft">{scope?.page ? `${tutorPages[scope.page]} · ` : ""}{subjectName}{scope?.questionId ? " · Questão atual" : scope?.materialId ? " · Material aberto" : ""}</p>
        </div>
        <button type="button" aria-label="Fechar assistente" onClick={() => dialog.current?.close()} className="rounded-lg p-2 text-ink-soft hover:bg-card hover:text-ink cursor-pointer"><X size={19} /></button>
      </header>
      {subjects && subjects.length > 0 && <div className="shrink-0 border-b border-line px-4 py-3">
        <label htmlFor="assistant-subject" className="mb-1 block text-xs font-semibold text-ink-soft">Matéria para esta conversa</label>
        <Select id="assistant-subject" value={selectedSubjectId} onChange={event => changeSubject(event.target.value)}>
          {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </Select>
      </div>}
      <div role="log" aria-label="Conversa com o assistente" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 && <>
          <p className="text-sm text-ink-soft">{scope?.subjectId ? `Pergunte sobre ${scope.questionId ? "o conceito da questão" : scope.materialId ? "este material" : `a matéria ${subjectName}`}.` : "Pergunte sobre esta página ou sobre como usar a plataforma."}</p>
          {scope && <div className="space-y-2">{suggestions.map(suggestion => <button key={suggestion} type="button" disabled={busy} onClick={() => void ask(suggestion)} className="block w-full rounded-xl border border-field-border bg-card px-3 py-2 text-left text-sm hover:border-pen hover:bg-pen-soft cursor-pointer">{suggestion}</button>)}</div>}
        </>}
        {messages.map((message, index) => <div key={index} className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "ml-auto whitespace-pre-wrap bg-pen text-white" : "mr-auto bg-surface text-ink"}`}>{message.role === "assistant" ? <AssistantAnswer text={message.text} /> : message.text}</div>)}
        {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Pensando na sua dúvida…</div>}
        {error && <p role="alert" className="rounded-xl bg-red-soft p-3 text-sm text-red">{error}</p>}
      </div>
      <form onSubmit={submit} className="max-h-[45%] shrink-0 overflow-y-auto border-t border-line bg-card p-3">
        {open && <details className="mb-2 text-xs text-muted"><summary className="cursor-pointer py-1 font-semibold">Consultar limite diário de IA</summary><TutorQuotaMeter revision={quotaRevision} /></details>}
        <div className="flex items-end gap-2">
          <TextArea aria-label="Sua pergunta para o assistente" rows={2} maxLength={1000} disabled={!scope} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(input); } }} placeholder={scope ? "Escreva sua dúvida…" : "Aguarde uma matéria ser publicada"} className="min-h-11 max-h-28" />
          <Button type="submit" aria-label="Enviar pergunta" disabled={!scope || busy || input.trim().length < 3} className="shrink-0 px-3"><Send size={18} /></Button>
        </div>
        <p className="mt-2 text-xs text-muted">Pode conter erros. Confira o material e a explicação da questão.</p>
      </form>
    </dialog>
  </>;
}
