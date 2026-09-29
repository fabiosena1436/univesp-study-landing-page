"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LibraryBig, Search, Trash2 } from "lucide-react";
import { useApp, toast } from "@/components/AppShell";
import { api } from "@/lib/api";
import { QuestionCard } from "@/components/QuestionCard";
import { Badge, Button, EmptyState, Input, Select, Spinner } from "@/components/ui";
import type { QuestionDB } from "@/lib/types";

export default function QuestoesPage() {
  return (
    <Suspense fallback={null}>
      <QuestoesInner />
    </Suspense>
  );
}

function QuestoesInner() {
  const { user, subjects } = useApp();
  const searchParams = useSearchParams();
  const mParam = searchParams.get("m") ?? "";

  const [subjectId, setSubjectId] = useState(mParam);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [list, setList] = useState<QuestionDB[] | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (subjectId) params.set("subjectId", subjectId);
    if (debounced) params.set("q", debounced);
    api<QuestionDB[]>(`/api/questions?${params.toString()}`)
      .then((rows) => alive && setList(rows))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [subjectId, debounced]);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);

  async function remove(id: string) {
    if (armed !== id) {
      setArmed(id);
      setTimeout(() => setArmed((a) => (a === id ? null : a)), 3000);
      return;
    }
    try {
      await api(`/api/questions/${id}`, { method: "DELETE" });
      setList((l) => (l ? l.filter((q) => q.id !== id) : l));
      toast("Questão removida do banco.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao remover.", "err");
    }
    setArmed(null);
  }

  return (
    <div className="space-y-5">
      <div className="anim-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Banco de questões</h1>
        <p className="mt-2 text-ink-soft">
          Consulte as questões publicadas pelo administrador, filtre por matéria e pesquise pelo enunciado.
        </p>
      </div>

      {/* toolbar */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="w-full sm:w-60">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Todas as matérias</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.questionCount})
              </option>
            ))}
          </Select>
        </div>
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no enunciado…"
            className="pl-9"
          />
        </div>
        {list && (
          <Badge tone="neutral">
            {list.length} quest{list.length === 1 ? "ão" : "ões"}
          </Badge>
        )}
      </div>

      {/* lista */}
      {list === null ? (
        <div className="card p-8 grid place-items-center text-muted">
          <Spinner size={22} />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<LibraryBig size={20} />}
          title={subject || debounced ? "Nada encontrado aqui" : "O banco ainda está vazio"}
          desc={
            subject || debounced
              ? "Tente outra matéria ou limpe a busca."
              : "Cole a revisão da faculdade no importador e as primeiras questões aparecem por aqui."
          }
          action={user.isAdmin ? (
            <Link href="/app/importar">
              <Button>Importar questões</Button>
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {list.map((q, i) => (
            <div key={q.id} className="relative group">
              <QuestionCard q={q} index={i + 1} />
              {subject && (
                <span className="absolute top-4 right-4 hidden md:inline-flex">
                  <Badge tone="neutral">{subject.name}</Badge>
                </span>
              )}
              <span className="absolute -bottom-2 left-4 z-10">
                <Badge tone={q.source === "material" ? "pen" : "neutral"}>
                  {q.source === "material" ? "PDF/material" : "revisão"}
                </Badge>
              </span>
              {user.isAdmin && (
                <button
                  onClick={() => remove(q.id)}
                  className={`absolute -bottom-2 right-4 z-10 inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 shadow-md transition-all cursor-pointer ${
                    armed === q.id
                      ? "bg-red text-white opacity-100"
                      : "bg-card border border-line text-muted opacity-0 group-hover:opacity-100 hover:text-red hover:border-red/30"
                  }`}
                >
                  <Trash2 size={12} />
                  {armed === q.id ? "Clique para confirmar" : "Remover"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
