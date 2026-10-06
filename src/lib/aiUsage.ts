export type TokenUsage = { input: number | null; output: number | null; thinking: number | null; total: number | null };
export type AiRequestEvent = { model: string; status: number; tokens: TokenUsage; message: string | null; retryAfter: number | null };
export type AiUsagePeriod = { calls: number; failures: number; unreported: number; input: number | null; output: number | null; thinking: number | null; total: number | null };
export type AiUsageSummary = { configured: boolean; models: string[]; startedAt: string | null; today: AiUsagePeriod; month: AiUsagePeriod; recent: (AiRequestEvent & { createdAt: string })[] };

const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function tokenUsage(raw: unknown): TokenUsage {
  const usage = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return { input: count(usage.promptTokenCount), output: count(usage.candidatesTokenCount), thinking: count(usage.thoughtsTokenCount), total: count(usage.totalTokenCount) };
}
export function geminiModels() {
  return (process.env.GEMINI_MODELS ?? "gemini-2.5-flash").split(",").map((m) => m.trim()).filter((m) => /^[a-zA-Z0-9.\-_]+$/.test(m)).slice(0, 2);
}
export function quotaDiagnostic(raw: unknown, retryHeader: string | null = null) {
  const error = raw && typeof raw === "object" ? (raw as { error?: { details?: unknown } }).error : null;
  const details = Array.isArray(error?.details) ? error.details : [];
  const violations = details.flatMap((d) => d && typeof d === "object" && Array.isArray(d.violations) ? d.violations : []);
  const ids = violations.map((v) => typeof v?.quotaId === "string" ? v.quotaId : "").join(" ");
  const minute = /PerMinute/i.test(ids), daily = /PerDay/i.test(ids), tokens = /Token/i.test(ids);
  const unavailable = violations.some((v) => v?.quotaValue === "0");
  const message = unavailable ? "O projeto está com cota zero para este modelo. Confira a disponibilidade e o faturamento no Google AI Studio."
    : daily ? "A cota diária do Gemini foi atingida. Confira os limites no Google AI Studio; as cotas diárias reiniciam à meia-noite do horário do Pacífico."
    : minute ? `O limite de ${tokens ? "tokens" : "solicitações"} por minuto do Gemini foi atingido. Aguarde antes de tentar novamente.`
    : "Limite ou cota do Gemini atingido. O provedor não informou um limite específico; consulte uso, limites e faturamento no Google AI Studio.";
  const retry = details.find((d) => d && typeof d === "object" && typeof d.retryDelay === "string")?.retryDelay;
  const seconds = typeof retry === "string" && /^\d+(?:\.\d+)?s$/.test(retry) ? Number(retry.slice(0, -1)) : retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : null;
  const retryAfter = seconds !== null && Number.isFinite(seconds) && seconds > 0 && seconds <= 86400 ? Math.ceil(seconds) : null;
  return { message: message + (retryAfter ? ` O provedor orienta tentar novamente em ${retryAfter} segundos.` : ""), retryAfter };
}
export async function recordAiRequest(event: AiRequestEvent) {
  if (!process.env.DATABASE_URL) return;
  try { await (await import("./aiUsageStore")).saveAiRequest(event); }
  catch { console.error(JSON.stringify({ event: "ai.usage.record_failed" })); }
}
