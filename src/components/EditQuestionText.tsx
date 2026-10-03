"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import type { QuestionDB } from "@/lib/types";
import type { ParsedQuestion } from "@/lib/types";
import { EditableQuestion } from "./EditableQuestion";

export default function EditQuestionText({ question, index, onSaved }: {
  question: QuestionDB; index: number; onSaved: (question: QuestionDB) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ParsedQuestion | null>(null);

  function open() {
    setDraft({ ...question, tempId: question.id, feedback: question.feedback ?? "", warnings: [] });
    setError("");
    setEditing(true);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api<QuestionDB>(`/api/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify({ editAll: true, statement: draft?.statement, feedback: draft?.feedback, options: draft?.options, correctKey: draft?.correctKey, originalStatement: question.statement, originalFeedback: question.feedback, originalOptions: question.options, originalCorrectKey: question.correctKey }),
      });
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a questão.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) return <div className="mt-4 mb-3"><Button variant="ghost" size="sm" onClick={open} aria-label={`Editar questão ${index}`}>Editar questão</Button></div>;

  return (
    <div className="mt-4 mb-3 rounded-xl border border-line bg-surface p-4 space-y-3">
      <p className="text-sm font-semibold">Editar questão {index}</p>
      <p className="text-sm text-muted">Revise o enunciado, as alternativas, o gabarito e a explicação. Provas já concluídas mantêm a versão usada na época.</p>
      <fieldset disabled={busy}>{draft && <EditableQuestion q={draft} index={index} onChange={setDraft} />}</fieldset>
      <div className="flex gap-3">
        <Button disabled={busy || !draft || draft.statement.trim().length < 15} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar questão"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar edição</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </div>
  );
}
