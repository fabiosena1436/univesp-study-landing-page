"use client";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import type { AiUsageSummary } from "@/lib/aiUsage";
import { Badge, Button, Spinner } from "@/components/ui";

const number = (value: number | null) => value === null ? "Não informado" : value.toLocaleString("pt-BR");
export default function AiUsagePanel() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api<AiUsageSummary>("/api/admin/ai-usage").then((data) => { if (alive) { setUsage(data); setError(""); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível consultar o uso da IA."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);
  return <section className="card p-5 space-y-4" aria-labelledby="ai-usage-title">
    <div className="flex flex-wrap gap-3 items-center justify-between"><h2 id="ai-usage-title" className="font-semibold text-xl">IA: uso e limites</h2><Button variant="ghost" disabled={loading} onClick={() => { setLoading(true); setRefresh((r) => r + 1); }}>Atualizar consumo</Button></div>
    <p className="text-sm text-muted">Consumo das chamadas Gemini e Groq feitas por este site. Consulte as cotas de cada provedor em seu painel. Um bloqueio pode ocorrer por solicitações ou tokens por minuto, cota diária ou faturamento.</p>
    <a className="inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper" href="https://aistudio.google.com/usage?timeRange=last-28-days&project=gen-lang-client-0918704470" target="_blank" rel="noopener noreferrer">Consultar consumo no Google AI Studio</a>
    <a className="inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper" href="https://console.groq.com/settings/limits" target="_blank" rel="noopener noreferrer">Consultar limites no Groq</a>
    {loading && <Spinner />}
    {error && <p role="alert" className="text-red">{error}</p>}
    {usage && <>
      <p className="text-sm"><Badge tone={usage.configured ? "pen" : "red"}>{usage.configured ? "Chave configurada" : "IA não configurada"}</Badge> <span className="break-words">Modelos: {usage.models.join(", ") || "Nenhum modelo válido"}</span></p>
      <p className="text-xs text-muted">{usage.startedAt ? `Primeira chamada registrada em ${formatDate(usage.startedAt)}.` : "Nenhuma chamada registrada ainda."} Chamadas anteriores a esta atualização e uso em outros aplicativos não entram neste contador. Períodos no horário de São Paulo.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="sr-only">Uso de tokens da IA pelo site</caption><thead><tr className="border-b border-line"><th className="p-2">Período</th><th className="p-2">Chamadas</th><th className="p-2">Falhas da API</th><th className="p-2">Entrada</th><th className="p-2">Saída</th><th className="p-2">Raciocínio</th><th className="p-2">Total de tokens</th></tr></thead><tbody>{([['Hoje', usage.today], ['Este mês', usage.month]] as const).map(([name, p]) => <tr className="border-b border-line" key={name}><th scope="row" className="p-2">{name}</th><td className="p-2">{number(p.calls)}</td><td className="p-2">{number(p.failures)}</td><td className="p-2">{number(p.input)}</td><td className="p-2">{number(p.output)}</td><td className="p-2">{number(p.thinking)}</td><td className="p-2 font-semibold">{number(p.total)}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted">Valores informados pela API; o total pode incluir tokens adicionais de ferramentas. {usage.month.unreported > 0 && `${usage.month.unreported} resposta(s) neste mês não informou(aram) o total de tokens; a soma está incompleta.`} Cada etapa de pesquisa, organização e tentativa em outro modelo conta como uma chamada.</p>
      <details className="group/calls rounded-xl border border-line p-3">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pen">
          <h3 className="font-semibold">Últimas chamadas</h3>
          <span className="text-sm font-semibold text-pen group-open/calls:hidden">Expandir chamadas</span>
          <span className="hidden text-sm font-semibold text-pen group-open/calls:inline">Ocultar chamadas</span>
        </summary>
        <div className="mt-3 space-y-3">{usage.recent.length === 0 ? <p className="text-sm text-muted">Faça uma geração para iniciar o acompanhamento.</p> : usage.recent.map((event, i) => <div className="border border-line rounded-xl p-3 space-y-1" key={`${event.createdAt}-${i}`}><p className="text-sm">{formatDate(event.createdAt)} · {event.model} · <Badge tone={event.status === 200 ? "pen" : "red"}>{event.status === 200 ? "Resposta recebida" : event.status === 429 ? "Cota ou limite atingido" : event.status === 0 ? "Falha de conexão ou resposta" : `Erro ${event.status}`}</Badge></p><p className="text-xs text-muted">Tokens: {number(event.tokens.total)}</p>{event.message && <p className="text-sm">{event.message}</p>}</div>)}</div>
      </details>
    </>}
  </section>;
}
