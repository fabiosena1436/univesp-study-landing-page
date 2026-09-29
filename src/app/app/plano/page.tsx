"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { toast } from "@/components/AppShell";
import type { ReviewQuestion, StudyPlan } from "@/lib/types";

export default function PlanoPage() {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [active, setActive] = useState<ReviewQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<StudyPlan>("/api/study/review")
      .then((next) => {
        if (!alive) return;
        setPlan(next);
        setActive(next.due[0] ?? null);
      })
      .catch(() => {
        if (alive) setPlan({ due: [], dueCount: 0, totalTracked: 0, masteredCount: 0, reviewedToday: 0 });
      });
    return () => {
      alive = false;
    };
  }, []);

  function choose(key: string) {
    if (!checked) setSelected(key);
  }

  async function rate(rating: "hard" | "good" | "easy") {
    if (!active || saving) return;
    setSaving(true);
    try {
      await api("/api/study/review", {
        method: "POST",
        body: JSON.stringify({ questionId: active.id, rating }),
      });
      const next = plan?.due.filter((q) => q.id !== active.id) ?? [];
      setPlan((p) => p ? { ...p, due: next, dueCount: next.length, reviewedToday: p.reviewedToday + 1 } : p);
      setActive(next[0] ?? null);
      setSelected(null);
      setChecked(false);
      toast(rating === "hard" ? "Vamos revisar amanhã." : "Revisão programada com sucesso.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar a revisão.", "err");
    } finally {
      setSaving(false);
    }
  }

  if (!plan) return <div className="card p-10 grid place-items-center text-muted"><Spinner size={24} /></div>;

  const correct = selected === active?.correctKey;
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Meu plano de estudo</h1>
        <p className="mt-2 text-ink-soft">Sessões curtas para revisar no momento certo e consolidar o conteúdo.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4"><p className="font-display text-2xl font-semibold">{plan.dueCount}</p><p className="text-xs text-muted">Revisões pendentes</p></div>
        <div className="card p-4"><p className="font-display text-2xl font-semibold">{plan.masteredCount}</p><p className="text-xs text-muted">Questões consolidadas</p></div>
        <div className="card p-4"><p className="font-display text-2xl font-semibold">{plan.reviewedToday}</p><p className="text-xs text-muted">Revisadas hoje</p></div>
      </div>

      {!active ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="Tudo em dia por enquanto"
          desc={plan.totalTracked === 0 ? "Faça uma prova para começar a construir sua fila de revisão." : "Volte amanhã para revisar novamente ou faça uma prova completa."}
          action={<Link href="/app/prova"><Button>Fazer uma prova</Button></Link>}
        />
      ) : (
        <div className="card p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="text-xs font-bold uppercase tracking-widest text-pen">{active.subjectName}</span>
            <span className="text-xs text-muted inline-flex items-center gap-1"><Clock3 size={14} /> revisão programada</span>
          </div>
          <h2 className="font-display text-xl font-semibold leading-relaxed">{active.statement}</h2>
          <div className="mt-5 space-y-2">
            {active.options.map((option) => (
              <button key={option.key} onClick={() => choose(option.key)} className={`w-full text-left rounded-xl border px-4 py-3 flex gap-3 transition-colors cursor-pointer ${selected === option.key ? "border-pen bg-pen-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                <span className="font-bold">{option.key}</span><span>{option.text}</span>
              </button>
            ))}
          </div>
          {!checked ? (
            <Button className="mt-5" disabled={!selected} onClick={() => setChecked(true)}>Verificar resposta</Button>
          ) : (
            <div className="mt-5 space-y-4">
              <p className={correct ? "text-green font-semibold" : "text-red font-semibold"}>{correct ? "Você acertou!" : "Você errou. Revise a explicação abaixo."}</p>
              {active.feedback && <p className="text-sm text-ink-soft whitespace-pre-line">{active.feedback}</p>}
              <div className="border-t border-line pt-4">
                <p className="text-sm font-semibold mb-3">Como foi para você?</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" disabled={saving} onClick={() => rate("hard")}>Difícil · amanhã</Button>
                  <Button disabled={saving} onClick={() => rate("good")}>Bom · em alguns dias</Button>
                  <Button variant="soft" disabled={saving} onClick={() => rate("easy")}><Sparkles size={15} /> Fácil · em 1 semana</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="card p-5 flex gap-3 items-start">
        <BrainCircuit className="text-pen shrink-0" size={20} />
        <p className="text-sm text-ink-soft">A revisão espaçada transforma seus erros em um plano automático: quanto melhor você domina uma questão, mais tempo até ela voltar.</p>
      </div>
    </div>
  );
}
