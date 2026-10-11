"use client";
import { useState } from "react";
import Link from "next/link";
import AuthShell from "./AuthShell";
import { Button } from "./ui";
import { api } from "@/lib/api";

export default function VerifyEmail({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function verify() {
    setBusy(true); setError("");
    try { await api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }); setDone(true); window.history.replaceState(null, "", "/confirmar-email"); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível confirmar."); }
    finally { setBusy(false); }
  }
  return <AuthShell><h1 className="font-display text-3xl font-semibold">{done ? "E-mail confirmado" : "Confirme seu e-mail"}</h1>
    <p className="mt-4">{done ? "Seu e-mail foi confirmado. O acesso ao conteúdo também depende da autorização do administrador." : "Clique abaixo para confirmar que este endereço de e-mail é seu. O link expira em 24 horas."}</p>
    {error && <p role="alert" className="mt-4 text-red">{error}</p>}
    {!done && <Button className="mt-6" disabled={busy || !token} onClick={verify}>{busy ? "Confirmando…" : "Confirmar meu e-mail"}</Button>}
    <Link className="mt-5 block text-pen underline" href="/aguardando-aprovacao">{done ? "Consultar meu acesso" : "Entrar para solicitar um novo link"}</Link>
  </AuthShell>;
}
