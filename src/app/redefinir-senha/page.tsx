"use client";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
export default function RedefinirSenhaPage() {
  return <Suspense fallback={null}><ResetForm /></Suspense>;
}
function ResetForm() {
  const router = useRouter(); const params = useSearchParams(); const token = params.get("token") ?? ""; const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); if (password !== confirm) { setError("As senhas não conferem."); return; } setBusy(true); try { await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); router.replace("/entrar?reset=ok"); } catch (x) { setError(x instanceof Error ? x.message : "Link inválido ou expirado."); } finally { setBusy(false); } }
  return <AuthShell><h1 className="font-display text-3xl font-semibold tracking-tight">Criar nova senha</h1><form onSubmit={submit} className="mt-7 space-y-4"><Field label="Nova senha"><Input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Field label="Confirmar senha"><Input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>{error && <p className="text-sm text-red">{error}</p>}<Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</Button></form></AuthShell>;
}
