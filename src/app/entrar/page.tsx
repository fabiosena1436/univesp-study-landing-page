"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mt-2 text-sm text-muted">
        Entra aí e bora rever o conteúdo.
      </p>
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Senha">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            required
            autoComplete="current-password"
          />
        </Field>
        {error && (
          <p className="text-sm font-semibold text-red bg-red-soft border border-red/20 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted text-center">
        <Link href="/recuperar-senha" className="text-pen font-semibold hover:underline">Esqueci minha senha</Link>
      </p>
      <p className="mt-3 text-sm text-muted text-center">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-pen font-semibold hover:underline">
          Criar grátis
        </Link>
      </p>
    </AuthShell>
  );
}
