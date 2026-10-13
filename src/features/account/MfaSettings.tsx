"use client";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export function MfaSettings() {
  const [status, setStatus] = useState<{ enabled: boolean; configured: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ enabled: boolean; configured: boolean }>("/api/account/mfa", { signal: controller.signal }).then(setStatus)
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível carregar a segurança."); });
    return () => controller.abort();
  }, []);
  async function change(action: "setup" | "enable" | "disable") {
    if (busy) return;
    if (action === "disable" && !window.confirm("Desativar a proteção em duas etapas?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await api<{ secret?: string; enabled?: boolean; recoveryCodes?: string[] }>("/api/account/mfa", { method: "POST", body: JSON.stringify({ action, password, code }) });
      if (result.secret) setSecret(result.secret);
      if (result.enabled !== undefined) { setStatus(current => current ? { ...current, enabled: result.enabled! } : current); setSecret(""); setCode(""); setPassword(""); setMessage(result.enabled ? "Proteção em duas etapas ativada. As outras sessões foram encerradas." : "Proteção em duas etapas desativada."); }
      if (result.recoveryCodes) setRecovery(result.recoveryCodes);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a proteção."); }
    finally { setBusy(false); }
  }
  return <section className="card p-6 space-y-4">
    <h2 className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck size={22} aria-hidden="true" /> Proteção em duas etapas</h2>
    <p className="text-sm text-ink-soft">Use um aplicativo autenticador para proteger sua conta, principalmente se você administra o conteúdo ou os usuários.</p>
    {status && <p className="font-semibold">{status.enabled ? "Proteção ativada" : "Proteção ainda não ativada"}</p>}
    {status && !status.configured && <p className="text-sm text-muted">Este recurso ainda não está disponível. Entre em contato com o responsável pelo serviço.</p>}
    {status?.configured && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void change(status.enabled ? "disable" : secret ? "enable" : "setup"); }}>
      <Field label="Confirme sua senha atual"><Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></Field>
      {secret && <div className="rounded-xl border border-line bg-surface p-4 space-y-2"><p>Adicione uma conta no aplicativo autenticador usando esta chave manual:</p><code className="block break-all select-all text-sm font-semibold">{secret}</code><p className="text-xs text-muted">Escolha código baseado em tempo. Depois informe o código de 6 dígitos para confirmar. Esta configuração expira em 10 minutos.</p></div>}
      {(secret || status.enabled) && <Field label="Código do autenticador ou de recuperação"><Input autoComplete="one-time-code" required maxLength={30} value={code} onChange={e => setCode(e.target.value)} disabled={busy} /></Field>}
      <Button type="submit" disabled={busy} variant={status.enabled ? "ghost" : "primary"}>{busy ? "Salvando…" : status.enabled ? "Desativar proteção" : secret ? "Confirmar e ativar" : "Configurar autenticador"}</Button>
    </form>}
    {error && <p role="alert" className="text-red text-sm">{error}</p>}
    {message && <p role="status" className="text-pen text-sm">{message}</p>}
    {recovery.length > 0 && <div className="rounded-xl border border-line bg-brand-soft p-4 space-y-3"><h3 className="font-semibold">Guarde seus códigos de recuperação</h3><p className="text-sm">Cada código funciona uma vez. Eles só são exibidos agora. Guarde-os em um local seguro antes de sair.</p><pre className="whitespace-pre-wrap break-all select-all text-sm">{recovery.join("\n")}</pre><Button size="sm" variant="ghost" onClick={() => { const url = URL.createObjectURL(new Blob([recovery.join("\n")], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = "aprova-univesp-recuperacao.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Baixar códigos de recuperação</Button><Button size="sm" variant="ghost" onClick={() => setRecovery([])}>Já guardei os códigos</Button></div>}
  </section>;
}
