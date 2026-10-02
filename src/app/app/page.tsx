"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  History as HistoryIcon,
  LibraryBig,
  Plus,
  BrainCircuit,
} from "lucide-react";
import { useApp, refreshSubjectsEvent } from "@/components/AppShell";
import { api, formatDate, formatDuration } from "@/lib/api";
import type { AttemptRow } from "@/lib/types";
import { SUBJECT_COLORS } from "@/lib/constants";
import { Button, Field, Input, Select } from "@/components/ui";
import { toast } from "@/components/AppShell";
import { PerformanceChart } from "@/components/PerformanceChart";
import { motion } from "motion/react";

export default function DashboardPage() {
  const { user, subjects, refreshSubjects } = useApp();
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api<AttemptRow[]>("/api/attempts")
      .then(setAttempts)
      .catch(() => toast("Não foi possível carregar seu desempenho. Atualize a página.", "err"))
      .finally(() => setLoading(false));
  }, []);

  const firstName = user.name.split(" ")[0];
  const totalQ = subjects.reduce((acc, s) => acc + s.questionCount, 0);
  const avgPct =
    attempts.length > 0
      ? Math.round(
          (attempts.reduce((acc, a) => acc + a.correctCount / Math.max(1, a.total), 0) /
            attempts.length) *
            100,
        )
      : null;

  const lastBySubject = new Map<string, AttemptRow>();
  for (const a of attempts) if (!lastBySubject.has(a.subjectId)) lastBySubject.set(a.subjectId, a);

  async function createSubject() {
    if (newName.trim().length < 2) {
      toast("Dê um nome com pelo menos 2 letras para a matéria.", "err");
      return;
    }
    setCreating(true);
    try {
      await api("/api/subjects", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      setNewName("");
      refreshSubjects();
      refreshSubjectsEvent();
      toast("Matéria criada. Bora importar as questões!");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao criar matéria.", "err");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* saudação */}
      <div className="anim-fade-up">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          Fala, {firstName}.
        </h1>
        <p className="mt-2 text-ink-soft">
          {totalQ === 0
            ? user.isAdmin
              ? "Seu banco está vazio — importe a primeira matéria para começar."
              : "O administrador ainda não publicou questões."
            : `Seu banco tem ${totalQ} quest${totalQ === 1 ? "ão" : "ões"} em ${subjects.length} matéria${subjects.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {/* métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Questões no banco", value: totalQ.toLocaleString("pt-BR") },
          { label: "Matérias", value: String(subjects.length) },
          { label: "Provas feitas", value: String(attempts.length) },
          { label: "Média recente nas provas", value: avgPct === null ? "—" : `${avgPct}%` },
        ].map((m) => (
          <motion.div
            key={m.label}
            className="card px-4 py-3.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <p className="font-display text-2xl font-semibold tabular-nums">{m.value}</p>
            <p className="text-xs text-muted mt-0.5">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {attempts.length > 0 && <PerformanceChart attempts={attempts} />}

      {/* ações rápidas */}
      <div className={`grid ${user.isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
        {user.isAdmin && (
          <Link
            href="/app/importar"
            className="card p-5 flex items-center gap-4 hover:border-line-strong transition-colors group"
          >
            <span className="w-11 h-11 rounded-xl bg-brand border border-ink/10 grid place-items-center shrink-0">
              <ClipboardPaste size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">Importar questões</h3>
              <p className="text-sm text-muted truncate">Cole a revisão da faculdade e salve no banco</p>
            </div>
            <ArrowRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
        <Link
          href="/app/plano"
          className="card p-5 flex items-center gap-4 hover:border-line-strong transition-colors group"
        >
          <span className="w-11 h-11 rounded-xl bg-pen-soft text-pen grid place-items-center shrink-0">
            <BrainCircuit size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Meu plano</h3>
            <p className="text-sm text-muted truncate">Revise o que precisa voltar hoje</p>
          </div>
          <ArrowRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/app/prova"
          className="card p-5 flex items-center gap-4 hover:border-line-strong transition-colors group"
        >
          <span className="w-11 h-11 rounded-xl bg-pen-soft text-pen grid place-items-center shrink-0">
            <FileText size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Gerar prova</h3>
            <p className="text-sm text-muted truncate">Escolha a matéria e treine agora</p>
          </div>
          <ArrowRight size={18} className="text-muted group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* matérias */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Suas matérias</h2>
          <Link href="/app/questoes" className="text-sm font-semibold text-pen hover:underline inline-flex items-center gap-1">
            <LibraryBig size={14} /> Ver banco completo
          </Link>
        </div>

        {subjects.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-display text-lg font-semibold">Nenhuma matéria ainda</p>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              {user.isAdmin
                ? "Crie a primeira abaixo ou já vá no importador colando a revisão."
                : "Aguarde o administrador publicar o material desta matéria."}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {subjects.map((s) => {
              const last = lastBySubject.get(s.id);
              const pct = last ? Math.round((last.correctCount / Math.max(1, last.total)) * 100) : null;
              return (
                <div key={s.id} className="card p-5 anim-fade-up">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full border border-ink/10" style={{ background: s.color }} />
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <span className="ml-auto text-xs font-semibold text-muted tabular-nums">
                      {s.questionCount} quest.{s.questionCount === 1 ? "" : "ões"}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-ink/8 overflow-hidden">
                    {pct !== null && (
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 70 ? "var(--color-green)" : pct >= 40 ? "var(--color-brand-deep)" : "var(--color-red)",
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                    <span>{pct === null ? "Ainda sem provas" : `Última prova: ${pct}%`}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" disabled={s.questionCount === 0} onClick={() => (window.location.href = `/app/prova?m=${s.id}`)}>
                      Provar
                    </Button>
                    {user.isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => (window.location.href = "/app/importar")}>
                        <Plus size={14} /> Importar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* nova matéria — somente administração */}
        {user.isAdmin && <div className="card p-5 mt-3">
          <p className="text-sm font-semibold mb-3">Adicionar matéria</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Ética, Banco de Dados, Cálculo I…"
                onKeyDown={(e) => e.key === "Enter" && createSubject()}
              />
            </div>
            <div className="flex items-center gap-1.5 pb-2">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    newColor === c ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`cor ${c}`}
                />
              ))}
            </div>
            <Button onClick={createSubject} disabled={creating}>
              {creating ? "Criando…" : "Criar"}
            </Button>
          </div>
        </div>}
      </section>

      {/* provas recentes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-semibold">Provas recentes</h2>
          <Link href="/app/historico" className="text-sm font-semibold text-pen hover:underline inline-flex items-center gap-1">
            <HistoryIcon size={14} /> Ver todas
          </Link>
        </div>
        {loading ? (
          <div className="card p-6 text-center text-sm text-muted">Carregando…</div>
        ) : attempts.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-muted">
              Nenhuma prova feita ainda.{" "}
              <Link href="/app/prova" className="text-pen font-semibold hover:underline">
                Gere a primeira
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {attempts.slice(0, 6).map((a) => {
              const pct = Math.round((a.correctCount / Math.max(1, a.total)) * 100);
              return (
                <Link
                  key={a.id}
                  href="/app/historico"
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.subjectName}</p>
                    <p className="text-xs text-muted">{formatDate(a.createdAt)}</p>
                  </div>
                  <span className="text-xs text-muted hidden sm:block tabular-nums">
                    {a.correctCount}/{a.total} · {formatDuration(a.durationSec)}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      pct >= 70 ? "text-green" : pct >= 40 ? "text-[#a07d00]" : "text-red"
                    }`}
                  >
                    {pct}%
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
