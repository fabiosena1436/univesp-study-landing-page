"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Select } from "@/components/ui";
import type { QuestionDB } from "@/lib/types";

export default function CompleteQuestionAnswer({ question, index, onSaved }: {
  question: QuestionDB; index: number; onSaved: (question: QuestionDB) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!answer || busy) return;
    setBusy(true); setError("");
    try {
      onSaved(await api<QuestionDB>(`/api/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ correctKey: answer }) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar o gabarito."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 mb-5 rounded-xl border border-line bg-surface p-4 space-y-3">
    <p className="text-sm font-semibold">Gabarito pendente — esta questão ainda não entra na prova.</p>
    <p className="text-sm text-muted">Confira as alternativas acima e selecione a correta. O sistema não inventa a resposta quando ela não vem no texto.</p>
    <div className="flex flex-wrap gap-3">
      <Select aria-label={`Gabarito da questão ${index}`} className="sm:w-48" value={answer} disabled={busy} onChange={(e) => setAnswer(e.target.value)}>
        <option value="">Selecione a correta</option>
        {question.options.map((o) => <option key={o.key} value={o.key}>Alternativa {o.key}</option>)}
      </Select>
      <Button disabled={!answer || busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar gabarito"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-red">{error}</p>}
  </div>;
}
