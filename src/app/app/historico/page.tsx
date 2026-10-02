"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, History as HistoryIcon } from "lucide-react";
import { api, formatDate, formatDuration } from "@/lib/api";
import { Badge, Button, EmptyState, Spinner } from "@/components/ui";
import type { AttemptDetail, AttemptRow } from "@/lib/types";

export default function HistoricoPage() {
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api<AttemptRow[]>(`/api/attempts?limit=50&offset=${page * 50}`)
      .then((rows) => { setAttempts(rows); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico."));
  }, [page]);

  async function toggle(a: AttemptRow) {
    if (openId === a.id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(a.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api<AttemptDetail>(`/api/attempts/${a.id}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar esta prova.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  if (error) return <div role="alert" className="card p-6">{error} <Button onClick={() => window.location.reload()}>Tentar novamente</Button></div>;
  if (attempts === null) {
    return (
      <div className="card p-10 grid place-items-center text-muted">
        <Spinner size={24} />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Histórico de provas</h1>
        {page > 0 && <Button onClick={() => setPage((p) => p - 1)}>Página anterior</Button>}
        <EmptyState
          icon={<HistoryIcon size={20} />}
          title={page ? "Fim do histórico" : "Nenhuma prova ainda"}
          desc="Quando você fizer a primeira prova, o resultado e cada resposta ficam registrados aqui."
          action={
            <Link href="/app/prova">
              <Button>Fazer uma prova</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const avg = Math.round(
    (attempts.reduce((acc, a) => acc + a.correctCount / Math.max(1, a.total), 0) /
      attempts.length) *
      100,
  );
  const best = Math.max(
    ...attempts.map((a) => Math.round((a.correctCount / Math.max(1, a.total)) * 100)),
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-center"><Button variant="ghost" disabled={page === 0} onClick={() => { setPage((p) => p - 1); setOpenId(null); }}>Anterior</Button><span>Página {page + 1}</span><Button variant="ghost" disabled={attempts.length < 50} onClick={() => { setPage((p) => p + 1); setOpenId(null); }}>Próxima</Button></div>
      <div className="anim-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Histórico de provas</h1>
        <p className="mt-2 text-xs text-muted">Os indicadores abaixo se referem às provas desta página.</p>
        <p className="mt-2 text-ink-soft">
          {attempts.length} prova{attempts.length === 1 ? "" : "s"} · média {avg}% · melhor {best}%
        </p>
      </div>

      <div className="space-y-3">
        {attempts.map((a) => {
          const pct = Math.round((a.correctCount / Math.max(1, a.total)) * 100);
          const open = openId === a.id;
          return (
            <div key={a.id} className="card overflow-hidden anim-fade-up">
              <button
                onClick={() => toggle(a)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface transition-colors cursor-pointer"
              >
                <span className="w-10 h-10 rounded-xl bg-pen-soft text-pen grid place-items-center shrink-0">
                  <FileText size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.subjectName}</p>
                  <p className="text-xs text-muted">
                    {formatDate(a.createdAt)} · {a.correctCount}/{a.total} · {formatDuration(a.durationSec)}
                  </p>
                </div>
                <div className="hidden sm:block w-28 h-1.5 rounded-full bg-ink/8 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 70 ? "var(--color-green)" : pct >= 40 ? "var(--color-brand-deep)" : "var(--color-red)",
                    }}
                  />
                </div>
                <span
                  className={`text-sm font-bold tabular-nums w-12 text-right ${
                    pct >= 70 ? "text-green" : pct >= 40 ? "text-[#a07d00]" : "text-red"
                  }`}
                >
                  {pct}%
                </span>
                <ChevronRight
                  size={16}
                  className={`text-muted transition-transform ${open ? "rotate-90" : ""}`}
                />
              </button>

              {open && (
                <div className="border-t border-line bg-surface/60 p-5">
                  {detailLoading ? (
                    <div className="flex justify-center py-6 text-muted">
                      <Spinner size={20} />
                    </div>
                  ) : !detail ? (
                    <p className="text-sm text-muted text-center py-4">Não foi possível carregar os detalhes.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.answers.map((ans, i) => {
                        const chosen = ans.options.find((o) => o.key === ans.selectedKey);
                        const correct = ans.options.find((o) => o.key === ans.correctKey);
                        return (
                          <div
                            key={i}
                            className={`rounded-xl border bg-card p-4 ${
                              ans.isCorrect ? "border-green/30" : "border-red/30"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Badge tone={ans.isCorrect ? "green" : "red"}>
                                {ans.isCorrect ? "Acertou" : ans.selectedKey ? "Errou" : "Em branco"}
                              </Badge>
                              <p className="text-sm leading-relaxed flex-1 line-clamp-3">
                                <span className="font-bold mr-1.5">{i + 1}.</span>
                                {ans.statement}
                              </p>
                            </div>
                            <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                              {ans.selectedKey && (
                                <Badge tone={ans.isCorrect ? "green" : "red"}>
                                  Você: {ans.selectedKey}
                                  {chosen ? ` · ${chosen.text.slice(0, 60)}…` : ""}
                                </Badge>
                              )}
                              {ans.correctKey && (
                                <Badge tone="neutral">
                                  Correta: {ans.correctKey}
                                  {correct ? ` · ${correct.text.slice(0, 60)}…` : ""}
                                </Badge>
                              )}
                            </div>
                            {ans.feedback && (
                              <details className="mt-2">
                                <summary className="text-xs font-semibold text-ink-soft cursor-pointer">
                                  Ler explicação
                                </summary>
                                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                                  {ans.feedback}
                                </p>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
