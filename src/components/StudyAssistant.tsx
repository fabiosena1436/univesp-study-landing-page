"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrainCircuit, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Spinner, TextArea } from "@/components/ui";

type Scope = { subjectId: string; materialId?: string; questionId?: string };
type Message = { role: "user" | "assistant"; text: string };
type TutorAnswer = { answer: string; hasReference: boolean; materialTitle: string };

export function StudyAssistant({ scope, subjectName }: { scope: Scope; subjectName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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

  const suggestions = scope.questionId
    ? ["Dê uma dica sem revelar a resposta", "Qual conceito preciso revisar?", "Explique o enunciado em outras palavras"]
    : scope.materialId
      ? ["Resuma os pontos principais", "Explique o conceito mais importante", `O que revisar em ${subjectName}?`]
      : [`Por onde começo a estudar ${subjectName}?`, "Quais são os conceitos essenciais?", "Crie uma pergunta para eu praticar"];

  async function ask(text: string) {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    const previous = messages.slice(-6);
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
      if (request.current === controller) request.current = null;
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Abrir assistente de estudos"
      className="fixed bottom-5 right-4 sm:right-7 z-40 inline-flex items-center gap-2 rounded-full bg-pen px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pen/25 hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen cursor-pointer">
      <BrainCircuit size={19} aria-hidden="true" /> Tirar dúvida
    </button>
    <dialog ref={dialog} onClose={() => { request.current?.abort(); setOpen(false); }} aria-labelledby="assistant-title"
      className="fixed inset-x-3 bottom-3 top-auto z-50 m-0 hidden h-[min(680px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-line-strong bg-card p-0 text-ink shadow-2xl backdrop:bg-ink/55 open:flex sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[430px]">
      <header className="flex items-center gap-3 border-b border-line bg-brand-soft/60 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pen text-white"><BrainCircuit size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="assistant-title" className="font-semibold">Assistente de estudos</h2>
          <p className="truncate text-xs text-ink-soft">{subjectName}{scope.questionId ? " · Questão atual" : scope.materialId ? " · Material aberto" : ""}</p>
        </div>
        <button type="button" aria-label="Fechar assistente" onClick={() => dialog.current?.close()} className="rounded-lg p-2 text-ink-soft hover:bg-card hover:text-ink cursor-pointer"><X size={19} /></button>
      </header>
      <div role="log" aria-label="Conversa com o assistente" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <>
          <p className="text-sm text-ink-soft">Pergunte sobre {scope.questionId ? "o conceito da questão" : scope.materialId ? "este material" : `a matéria ${subjectName}`}.</p>
          <div className="space-y-2">{suggestions.map(suggestion => <button key={suggestion} type="button" disabled={busy} onClick={() => void ask(suggestion)} className="block w-full rounded-xl border border-field-border bg-card px-3 py-2 text-left text-sm hover:border-pen hover:bg-pen-soft cursor-pointer">{suggestion}</button>)}</div>
        </>}
        {messages.map((message, index) => <div key={index} className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${message.role === "user" ? "ml-auto bg-pen text-white" : "mr-auto bg-surface text-ink"}`}>{message.text}</div>)}
        {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Pensando na sua dúvida…</div>}
        {error && <p role="alert" className="rounded-xl bg-red-soft p-3 text-sm text-red">{error}</p>}
      </div>
      <form onSubmit={submit} className="border-t border-line bg-card p-3">
        <div className="flex items-end gap-2">
          <TextArea aria-label="Sua pergunta para o assistente" rows={2} maxLength={1000} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(input); } }} placeholder="Escreva sua dúvida…" className="min-h-11 max-h-28" />
          <Button type="submit" aria-label="Enviar pergunta" disabled={busy || input.trim().length < 3} className="shrink-0 px-3"><Send size={18} /></Button>
        </div>
        <p className="mt-2 text-xs text-muted">Pode conter erros. Confira o material e a explicação da questão.</p>
      </form>
    </dialog>
  </>;
}
