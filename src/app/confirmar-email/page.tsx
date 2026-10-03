"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import EmailVerificationPending from "@/components/EmailVerificationPending";
export default function ConfirmarEmail() { return <Suspense fallback={<p>Carregando…</p>}><Confirmation /></Suspense>; }
function Confirmation() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError("");
    try { const result = await api<{ message: string }>(token ? "/api/auth/verify-email" : "/api/auth/resend-verification", { method: "POST", body: JSON.stringify(token ? { token } : { email }) }); setMessage(result.message); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível confirmar."); }
    finally { setBusy(false); }
  }
  if (!token && message) return <AuthShell><h1 className="font-display text-3xl">Confira seu e-mail</h1><div className="mt-5"><EmailVerificationPending email={email.trim().toLowerCase()} message={message} /></div><Link href="/confirmar-email" onClick={() => setMessage("")} className="mt-4 block text-sm text-pen underline">Informar outro endereço</Link></AuthShell>;
  return <AuthShell><h1 className="font-display text-3xl">Confirmar e-mail</h1><p className="mt-3 text-muted">Confirme que você controla seu endereço para acessar o catálogo. A entrega pode levar alguns minutos; confira também Outros e Lixo Eletrônico.</p><form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    {!token && <Field label="E-mail da conta"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red">{error}</p>}
    <Button type="submit" disabled={busy || Boolean(token && message)}>{busy ? "Enviando…" : token ? "Confirmar meu e-mail" : "Enviar novo link"}</Button>
    <Link className="block text-pen" href="/entrar">Ir para o login</Link>{token && <Link className="block text-pen" href="/confirmar-email">Solicitar outro link</Link>}
  </form></AuthShell>;
}
