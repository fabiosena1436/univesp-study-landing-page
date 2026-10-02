"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { useApp, toast } from "@/components/AppShell";
import { api } from "@/lib/api";
import { Badge, Button, EmptyState, Select, Spinner } from "@/components/ui";
import type { Flashcard } from "@/lib/types";

export default function FlashcardsPage() {
  const { subjects } = useApp();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const ratingLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : "";
      setCards(await api<Flashcard[]>(`/api/study/flashcards${query}`));
      setIndex(0);
      setFlipped(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível carregar os flashcards.", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    api<Flashcard[]>("/api/study/flashcards")
      .then((next) => {
        if (alive) setCards(next);
      })
      .catch((e) => { if (alive) { setCards([]); setError(e instanceof Error ? e.message : "Não foi possível carregar os cartões."); } });
    return () => {
      alive = false;
    };
  }, []);

  const active = cards?.[index];

  async function rate(rating: "hard" | "good" | "easy") {
    if (!active || ratingLock.current) return;
    ratingLock.current = true; setSaving(true);
    try {
      await api("/api/study/review", {
        method: "POST",
        body: JSON.stringify({ questionId: active.id, rating }),
      });
      if (index + 1 >= (cards?.length ?? 0)) {
        toast("Sessão concluída. Revisão programada!");
        setCards([]);
      } else {
        setIndex((value) => value + 1);
        setFlipped(false);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível salvar sua revisão.", "err");
    } finally { ratingLock.current = false; setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Flashcards</h1>
        <p className="mt-2 text-ink-soft">Tente lembrar antes de revelar. Depois, avalie a dificuldade para programar sua próxima revisão.</p>
      </div>
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <label htmlFor="flashcard-subject" className="text-sm font-semibold">Matéria</label>
        <Select id="flashcard-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="flex-1 min-w-48">
          <option value="">Todas as matérias</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </Select>
        <Button variant="ghost" onClick={load} disabled={loading}><RotateCcw size={15} /> Nova sessão</Button>
      </div>
      {error && <p role="alert" className="text-red">{error}</p>}
      {loading || cards === null ? (
        <div className="card p-12 grid place-items-center text-muted"><Spinner size={25} /></div>
      ) : !active ? (
        <EmptyState icon={<CheckCircle2 size={22} />} title="Nenhum cartão nesta sessão" desc="Se você concluiu a sessão, a revisão foi programada. Você também pode selecionar outra matéria e carregar uma nova sessão." action={<Link href="/app/plano"><Button>Ver meu plano</Button></Link>} />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted">
            <Badge tone="pen">{active.subjectName}</Badge>
            <span>{index + 1} de {cards.length}</span>
          </div>
          <button onClick={() => setFlipped((value) => !value)} className="card min-h-80 w-full p-8 md:p-12 text-center flex flex-col items-center justify-center cursor-pointer hover:border-pen transition-colors">
            <Brain className="text-pen mb-5" size={28} />
            <span className="text-xs uppercase tracking-widest font-bold text-muted mb-4">{flipped ? "Resposta" : "Lembrete"}</span>
            <p className="font-display text-2xl font-semibold leading-relaxed whitespace-pre-line">{flipped ? active.back : active.front}</p>
            {flipped && active.feedback && <p className="mt-5 text-sm text-ink-soft leading-relaxed whitespace-pre-line">{active.feedback}</p>}
            {!flipped && <span className="mt-8 text-sm text-pen font-semibold">Clique para revelar</span>}
          </button>
          {flipped ? (
            <div className="card p-5">
              <p className="text-sm font-semibold mb-3">Como foi?</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" disabled={saving} onClick={() => rate("hard")}>Difícil</Button>
                <Button disabled={saving} onClick={() => rate("good")}>Bom</Button>
                <Button disabled={saving} variant="soft" onClick={() => rate("easy")}><Sparkles size={15} /> Fácil</Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted">A recuperação ativa ajuda a fixar melhor o conteúdo.</p>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" disabled={saving || index === 0} onClick={() => { setIndex((value) => value - 1); setFlipped(false); }}><ArrowLeft size={15} /> Anterior</Button>
            <Button variant="ghost" size="sm" disabled={saving || index + 1 >= cards.length} onClick={() => { setIndex((value) => value + 1); setFlipped(false); }}>Próximo <ArrowRight size={15} /></Button>
          </div>
        </>
      )}
    </div>
  );
}
