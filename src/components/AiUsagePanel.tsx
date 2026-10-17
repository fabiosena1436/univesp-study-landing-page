"use client";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import type { AiProviderUsage, AiUsageSummary } from "@/lib/aiUsage";
import { AdminSection } from "./AdminSection";
import { Badge, Button, Spinner } from "@/components/ui";

const number = (value: number | null) => value === null ? "Não informado" : value.toLocaleString("pt-BR");
export default function AiUsagePanel() {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api<AiUsageSummary>("/api/admin/ai-usage").then(data => { if (alive) { setUsage(data); setError(""); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível consultar o uso da IA."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refresh]);
  return <AdminSection title="IA: uso e limites">
    <div className="flex flex-wrap gap-3 items-center justify-between"><Button variant="ghost" disabled={loading} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Atualizar consumo</Button></div>
    <p className="text-sm text-muted">Consumo separado por provedor: Gemini gera questões; Groq atende o assistente de estudos. Os valores abaixo são do site, não o saldo disponível da conta em cada provedor.</p>
    {loading && <Spinner />}
    {error && <p role="alert" className="text-red">{error}</p>}
    {usage && <div className="space-y-4">{usage.providers.map(provider => <ProviderUsage key={provider.provider} usage={provider} />)}</div>}
    <p className="text-xs text-muted">Chamadas anteriores ao início do registro e uso em outros aplicativos não entram nestes contadores. Períodos no horário de São Paulo. Os provedores podem limitar solicitações ou tokens por minuto, cota diária ou faturamento.</p>
  </AdminSection>;
}

function ProviderUsage({ usage }: { usage: AiProviderUsage }) {
  const gemini = usage.provider === "gemini", name = gemini ? "Gemini" : "Groq";
  return <section aria-labelledby={`usage-${usage.provider}`} className="min-w-0 rounded-xl border border-line p-3 sm:p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 id={`usage-${usage.provider}`} className="text-lg font-semibold">{name} · {gemini ? "Geração de questões" : "Assistente de estudos"}</h3><Badge tone={usage.configured ? "pen" : "red"}>{usage.configured ? `Chave ${name} configurada` : `Chave ${name} não configurada`}</Badge></div>
    <p className="break-words text-sm">Modelo(s): {usage.models.join(", ") || "Nenhum modelo válido"}</p>
    <a className="inline-flex max-w-full items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper" href={gemini ? "https://aistudio.google.com/usage?timeRange=last-28-days&project=gen-lang-client-0918704470" : "https://console.groq.com/settings/limits"} target="_blank" rel="noopener noreferrer">{gemini ? "Consultar consumo no Google AI Studio" : "Consultar limites no Groq"}</a>
    <p className="text-xs text-muted">{usage.startedAt ? `Primeira chamada ${name} registrada em ${formatDate(usage.startedAt)}.` : `Nenhuma chamada ${name} registrada ainda.`}</p>
    <div role="region" aria-label={`Tabela de consumo ${name}`} tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-pen"><table className="w-full text-sm text-left"><caption className="sr-only">Uso de tokens {name} pelo site</caption><thead><tr className="border-b border-line"><th className="p-2">Período</th><th className="p-2">Chamadas</th><th className="p-2">Falhas da API</th><th className="p-2">Entrada</th><th className="p-2">Saída</th><th className="p-2">Raciocínio</th><th className="p-2">Total de tokens</th></tr></thead><tbody>{([['Hoje', usage.today], ['Este mês', usage.month]] as const).map(([period, p]) => <tr className="border-b border-line" key={period}><th scope="row" className="p-2">{period}</th><td className="p-2">{number(p.calls)}</td><td className="p-2">{number(p.failures)}</td><td className="p-2">{number(p.input)}</td><td className="p-2">{number(p.output)}</td><td className="p-2">{number(p.thinking)}</td><td className="p-2 font-semibold">{number(p.total)}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-muted">Valores informados pela API {name}; o total pode incluir tokens adicionais de ferramentas. {usage.month.unreported > 0 && `${usage.month.unreported} resposta(s) neste mês não informou(aram) o total de tokens; a soma está incompleta.`} Cada tentativa conta como uma chamada.</p>
    <details className="group/calls rounded-xl border border-line p-3"><summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pen"><h4 className="font-semibold">Últimas chamadas {name}</h4><span className="text-sm font-semibold text-pen group-open/calls:hidden">Expandir chamadas</span><span className="hidden text-sm font-semibold text-pen group-open/calls:inline">Ocultar chamadas</span></summary>
      <div className="mt-3 space-y-3">{usage.recent.length === 0 ? <p className="text-sm text-muted">{gemini ? "Gere questões para iniciar o acompanhamento do Gemini." : "Use o assistente de estudos para iniciar o acompanhamento do Groq."}</p> : usage.recent.map((event, index) => <div key={`${event.createdAt}-${index}`} className="min-w-0 rounded-xl border border-line p-3 space-y-1"><p className="break-words text-sm">{formatDate(event.createdAt)} · {name} · {event.model} · <Badge tone={event.status === 200 ? "pen" : "red"}>{event.status === 200 ? "Resposta recebida" : event.status === 429 ? "Cota ou limite atingido" : event.status === 0 ? "Falha de conexão ou resposta" : `Erro ${event.status}`}</Badge></p><p className="text-xs text-muted">Tokens: {number(event.tokens.total)}</p>{event.message && <p className="break-words text-sm">{event.message}</p>}</div>)}</div>
    </details>
  </section>;
}
