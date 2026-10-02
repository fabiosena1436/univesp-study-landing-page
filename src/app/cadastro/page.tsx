"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import { UNIVESP_STUDENT_EMAIL_RE } from "@/lib/constants";

export default function CadastroPage() {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (!UNIVESP_STUDENT_EMAIL_RE.test(email.trim())) {
      setError("Use seu e-mail institucional no formato nome@aluno.univesp.br.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, course, password }),
      });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-2 text-sm text-muted">
        Acesso ao catálogo compartilhado e histórico individual. Confirme seu e-mail institucional para entrar.
      </p>
      {message && <p role="status" className="mt-5">{message} <Link href="/confirmar-email" className="text-pen underline">Solicitar confirmação</Link></p>}
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Field label="Seu nome">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como te chamam no grupo"
            required
            minLength={2}
            autoComplete="name"
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seunome@aluno.univesp.br"
            required
            autoComplete="email"
          />
          <p className="mt-1.5 text-xs text-muted">Use seu e-mail institucional @aluno.univesp.br.</p>
        </Field>
        <Field label="Curso">
          <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Ex.: Engenharia de Computação" required minLength={2} />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Crie uma senha"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirmar senha">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repetir a senha"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <p className="text-sm font-semibold text-red bg-red-soft border border-red/20 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || Boolean(message)}>
          {busy ? "Criando…" : "Criar conta grátis"}
        </Button>
      </form>
      <p className="mt-4 text-xs text-muted">Ao criar uma conta, você concorda com os <Link href="/termos" className="underline">termos</Link> e conhece a <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
      <p className="mt-6 text-sm text-muted text-center">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-pen font-semibold hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
