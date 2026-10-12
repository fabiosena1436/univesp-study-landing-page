"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import { canStudy, normalizeWhatsapp } from "@/lib/access";

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [course, setCourse] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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
    if (!normalizeWhatsapp(whatsapp)) {
      setError("Informe um WhatsApp brasileiro válido com DDD.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, course, whatsapp, password }),
      });
      router.replace(canStudy(result.user) ? "/app" : "/aguardando-aprovacao");
      router.refresh();
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
        Crie sua conta e aguarde a autorização de acesso. E-mails da lista do administrador já ficam pré-autorizados.
      </p>
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
          <p className="mt-1.5 text-xs text-muted">Use preferencialmente seu e-mail @aluno.univesp.br.</p>
        </Field>
        <Field label="Curso">
          <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Ex.: Engenharia de Computação" required minLength={2} />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          {/* A autorização de acesso é verificada no servidor. */}
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
        <Field label="WhatsApp com DDD">
          <Input type="tel" autoComplete="tel" required maxLength={40} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
          <p className="mt-1.5 text-xs text-muted">O administrador poderá usar este número para avisar sobre a aprovação do acesso.</p>
        </Field>
        {error && (
          <p className="text-sm font-semibold text-red bg-red-soft border border-red/20 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
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
