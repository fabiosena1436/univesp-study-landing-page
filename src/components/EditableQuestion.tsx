"use client";

import type { ParsedQuestion } from "@/lib/types";
import { LETTERS } from "@/lib/parser";
import { Badge, Button, TextArea } from "./ui";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

export function EditableQuestion({
  q,
  index,
  onChange,
  onDelete,
}: {
  q: ParsedQuestion;
  index: number | string;
  onChange: (q: ParsedQuestion) => void;
  onDelete?: () => void;
}) {
  const set = (patch: Partial<ParsedQuestion>) => onChange({ ...q, ...patch });

  return (
    <div className="card p-5 anim-fade-up">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-8 h-8 rounded-lg bg-ink text-paper grid place-items-center text-sm font-bold font-display">
          {index}
        </span>
        <span className="text-sm font-semibold">Questão {index}</span>
        {q.warnings.map((w, i) => (
          <Badge key={i} tone="amber">
            <AlertTriangle size={12} /> {w}
          </Badge>
        ))}
        {onDelete && (
          <button
            onClick={onDelete}
            title="Remover esta questão"
            className="ml-auto p-2 rounded-lg text-muted hover:text-red hover:bg-red-soft transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Enunciado</p>
        <TextArea
          aria-label={`Enunciado da questão ${index}`}
          rows={4}
          value={q.statement}
          onChange={(e) => set({ statement: e.target.value })}
          placeholder="Cole ou digite o enunciado da questão"
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
          Alternativas — clique no círculo para marcar a correta
        </p>
        <div className="space-y-2">
          {q.options.map((o) => {
            const isCorrect = q.correctKey === o.key;
            return (
              <div
                key={o.key}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  isCorrect ? "border-green/50 bg-green-soft" : "border-line bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name={`correct-${q.tempId}`}
                  checked={isCorrect}
                  onChange={() => set({ correctKey: o.key })}
                  className="mt-3 accent-[var(--color-green)] cursor-pointer"
                  aria-label={`Marcar alternativa ${o.key} como correta`}
                />
                <span className="shrink-0 w-7 h-7 mt-1 rounded-lg grid place-items-center text-xs font-bold bg-card border border-line-strong">
                  {o.key}
                </span>
                <TextArea
                  aria-label={`Texto da alternativa ${o.key}`}
                  rows={2}
                  value={o.text}
                  onChange={(e) =>
                    set({
                      options: q.options.map((x) => (x.key === o.key ? { ...x, text: e.target.value } : x)),
                    })
                  }
                  className="bg-transparent border-transparent hover:border-line focus:bg-card focus:border-ink"
                />
                {q.options.length > 2 && (
                  <button
                    title="Remover alternativa"
                    onClick={() =>
                      set({
                        options: q.options
                          .filter((x) => x.key !== o.key)
                          .map((x, i) => ({ ...x, key: LETTERS[i] })),
                        correctKey: q.correctKey === o.key ? null : LETTERS[q.options.filter((x) => x.key !== o.key).findIndex((x) => x.key === q.correctKey)] ?? null,
                      })
                    }
                    className="p-1.5 mt-1 rounded-md text-muted hover:text-red hover:bg-red-soft transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {q.options.length < 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() =>
              set({
                options: [...q.options, { key: LETTERS[q.options.length], text: "" }],
              })
            }
          >
            <Plus size={14} /> Adicionar alternativa
          </Button>
        )}
      </div>

      {q.sourceExcerpt && <blockquote className="mt-4 border-l-4 border-pen pl-3 text-sm text-ink-soft"><strong>Trecho de origem para conferência:</strong><p className="mt-1 whitespace-pre-line">{q.sourceExcerpt}</p></blockquote>}
      <details className="mt-4">
        <summary className="text-sm font-semibold text-ink-soft cursor-pointer hover:text-ink flex items-center gap-1.5">
          Explicação / feedback do sistema
        </summary>
        <TextArea
          aria-label="Explicação da resposta"
          rows={5}
          className="mt-2"
          value={q.feedback}
          onChange={(e) => set({ feedback: e.target.value })}
          placeholder="A explicação de cada alternativa que vem na revisão"
        />
      </details>
    </div>
  );
}
