"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }); setSent(true); } catch (x) { setError(x instanceof Error ? x.message : "Não foi possível solicitar a recuperação."); } finally { setBusy(false); } }
  return <AuthShell><h1 className="font-display text-3xl font-semibold tracking-tight">Recuperar senha</h1><p className="mt-2 text-sm text-muted">Informe seu e-mail institucional e enviaremos um link.</p>{sent ? <p className="mt-7 rounded-xl bg-green-soft p-4 text-sm">Se o e-mail estiver cadastrado, confira sua caixa de entrada.</p> : <form onSubmit={submit} className="mt-7 space-y-4"><Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seunome@aluno.univesp.br" required /></Field>{error && <p className="text-sm text-red">{error}</p>}<Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Enviar link"}</Button></form>}<p className="mt-6 text-sm text-muted text-center"><Link href="/entrar" className="text-pen font-semibold">Voltar para entrar</Link></p></AuthShell>;
}
