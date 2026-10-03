"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, TextArea } from "@/components/ui";
import type { QuestionDB } from "@/lib/types";

export default function EditQuestionText({ question, index, onSaved }: {
  question: QuestionDB; index: number; onSaved: (question: QuestionDB) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setStatement(question.statement);
    setFeedback(question.feedback ?? "");
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
        body: JSON.stringify({ statement, feedback, originalStatement: question.statement, originalFeedback: question.feedback }),
      });
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a questão.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) return <div className="mt-4 mb-3"><Button variant="ghost" size="sm" onClick={open} aria-label={`Editar texto da questão ${index}`}>Editar texto</Button></div>;

  return (
    <div className="mt-4 mb-3 rounded-xl border border-line bg-surface p-4 space-y-3">
      <p className="text-sm font-semibold">Editar texto da questão {index}</p>
      <p className="text-sm text-muted">Escreva uma pergunta que possa ser respondida sem consultar o material de origem.</p>
      <label className="block text-sm">Enunciado
        <TextArea aria-label={`Novo enunciado da questão ${index}`} value={statement} disabled={busy} maxLength={12000} onChange={(e) => setStatement(e.target.value)} />
      </label>
      <label className="block text-sm">Explicação
        <TextArea aria-label={`Nova explicação da questão ${index}`} value={feedback} disabled={busy} maxLength={20000} onChange={(e) => setFeedback(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <Button disabled={busy || statement.trim().length < 15} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar texto"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar edição</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
    </div>
  );
}
