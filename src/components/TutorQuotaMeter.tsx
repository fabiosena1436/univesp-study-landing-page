"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TutorQuotaStatus } from "@/lib/tutorQuotaPolicy";

export function TutorQuotaMeter({ revision }: { revision: number }) {
  const [quota, setQuota] = useState<TutorQuotaStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<TutorQuotaStatus>("/api/tutor/quota", { signal: controller.signal }).then(value => { setQuota(value); setError(false); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [revision]);
  if (error) return <p className="text-xs text-muted">Não foi possível atualizar sua cota. O limite será conferido ao enviar.</p>;
  if (!quota) return <p className="text-xs text-muted">Consultando sua cota…</p>;
  const reset = new Date(quota.resetAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return <div className={`rounded-lg p-2 text-xs space-y-1 ${quota.warning || !quota.sharedAvailable ? "bg-red-soft text-red" : "bg-surface text-ink-soft"}`} role="status">
    <p><strong>{quota.messagesRemaining} de {quota.messagesLimit} consultas disponíveis</strong> · {quota.tokensRemaining.toLocaleString("pt-BR")} tokens do seu orçamento.</p>
    <p>Renovação do site: {reset} (Brasília). Vale o limite que acabar primeiro. Consultas maiores usam mais tokens.</p>
    {!quota.sharedAvailable ? <p>A reserva diária da comunidade acabou. Materiais e provas continuam disponíveis.</p> : !quota.messagesRemaining || !quota.tokensRemaining ? <p>Sua cota diária acabou. Aguarde a renovação indicada acima; materiais e provas continuam disponíveis.</p> : quota.warning && <p>Sua cota está perto do fim. Perguntas curtas ajudam a aproveitá-la.</p>}
    <p>Controle do aplicativo; o provedor pode limitar antes. Reservas em andamento podem reduzir temporariamente o saldo.</p>
  </div>;
}
