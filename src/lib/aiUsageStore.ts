import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { geminiModels, type AiRequestEvent, type AiUsagePeriod, type AiUsageSummary } from "./aiUsage";
import { rateLimit } from "./rateLimit";
import { currentAiOperation } from "./aiOperation";

export async function reserveAiCall(body: Record<string, unknown>) {
  const operation = currentAiOperation();
  if (!operation) return;
  const output = Number((body.generationConfig as { maxOutputTokens?: number } | undefined)?.maxOutputTokens ?? 16000);
  // Conservative reservation includes room for thinking tokens; it is a hard
  // reservation budget, not a bill/estimate of the provider's actual charge.
  const reserved = Math.ceil(Buffer.byteLength(JSON.stringify(body), "utf8") + output * 2);
  const budget = (name: string, fallback: number) => {
    const n = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(n) || n < 1 || n > 1000000000) throw new Error(`Invalid ${name}`);
    return n;
  };
  const month = new Date().toISOString().slice(0, 7);
  await rateLimit("ai.tokens.user.24h", operation.actorId, budget("AI_USER_DAILY_TOKEN_BUDGET", 500000), 86400000, false, reserved);
  await rateLimit(`ai.tokens.month.${month}`, "global", budget("AI_MONTHLY_TOKEN_BUDGET", 5000000), 32 * 86400000, false, reserved);
}

// Reuse the durable event log, shared by all server instances.
export async function saveAiRequest(event: AiRequestEvent) {
  await db.insert(auditEvents).values({ actorId: event.actorId, action: event.provider === "groq" ? "groq.request" : "gemini.request", targetId: JSON.stringify(event) });
}
export async function readAiUsage(): Promise<AiUsageSummary> {
  const [summary, recent] = await Promise.all([
    db.execute(sql`
      WITH events AS (SELECT created_at, CASE WHEN action='groq.request' THEN 'groq' ELSE 'gemini' END AS provider, target_id::jsonb AS data FROM audit_events WHERE action IN ('gemini.request', 'groq.request')),
      periods AS (SELECT 'today' AS name, (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo' AS start
        UNION ALL SELECT 'month', date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),
      providers AS (SELECT unnest(ARRAY['all','gemini','groq']) AS provider)
      SELECT s.provider, p.name, count(e.created_at)::int AS calls,
        count(e.created_at) FILTER (WHERE (e.data->>'status')::int <> 200)::int AS failures,
        count(e.created_at) FILTER (WHERE (e.data->>'status')::int = 200 AND e.data->'tokens'->>'total' IS NULL)::int AS unreported,
        sum((e.data->'tokens'->>'input')::bigint) AS input, sum((e.data->'tokens'->>'output')::bigint) AS output,
        sum((e.data->'tokens'->>'thinking')::bigint) AS thinking, sum((e.data->'tokens'->>'total')::bigint) AS total,
        (SELECT min(created_at) AT TIME ZONE 'UTC' FROM events WHERE s.provider='all' OR provider=s.provider) AS started_at
      FROM providers s CROSS JOIN periods p LEFT JOIN events e ON (s.provider='all' OR e.provider=s.provider) AND e.created_at AT TIME ZONE 'UTC' >= p.start GROUP BY s.provider, p.name
    `),
    db.execute(sql`SELECT action, target_id, created_at AT TIME ZONE 'UTC' AS created_at FROM (
      SELECT action, target_id, created_at, id, row_number() OVER (PARTITION BY action ORDER BY created_at DESC, id DESC) AS rank
      FROM audit_events WHERE action IN ('gemini.request','groq.request')
    ) recent WHERE rank<=10 ORDER BY created_at DESC, id DESC`),
  ]);
  function period(name: string, provider = "all"): AiUsagePeriod {
    const row = summary.rows.find((r) => r.name === name && r.provider === provider);
    const value = (key: string) => row?.[key] == null ? Number(row?.calls ?? 0) === 0 ? 0 : null : Number(row[key]);
    return { calls: value("calls") ?? 0, failures: value("failures") ?? 0, unreported: value("unreported") ?? 0, input: value("input"), output: value("output"), thinking: value("thinking"), total: value("total") };
  }
  const startedAt = (provider: string) => {
    const value = summary.rows.find(row => row.provider === provider)?.started_at;
    return value ? new Date(String(value)).toISOString() : null;
  };
  const events = recent.rows.map(row => ({ ...JSON.parse(String(row.target_id)) as AiRequestEvent, provider: row.action === "groq.request" ? "groq" as const : "gemini" as const, createdAt: new Date(String(row.created_at)).toISOString() }));
  const providers = (["gemini", "groq"] as const).map(provider => ({
    provider, configured: Boolean((provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY)?.trim()),
    models: provider === "gemini" ? geminiModels() : [process.env.GROQ_TUTOR_MODEL?.trim() || "openai/gpt-oss-120b"],
    startedAt: startedAt(provider), today: period("today", provider), month: period("month", provider), recent: events.filter(event => event.provider === provider),
  }));
  return { configured: providers.some(provider => provider.configured), models: providers.flatMap(provider => provider.models),
    startedAt: startedAt("all"),
    today: period("today"), month: period("month"),
    recent: [...events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 10), providers };
}
