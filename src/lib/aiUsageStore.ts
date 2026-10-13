import { sql, desc, eq } from "drizzle-orm";
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
  await db.insert(auditEvents).values({ actorId: event.actorId, action: "gemini.request", targetId: JSON.stringify(event) });
}
export async function readAiUsage(): Promise<AiUsageSummary> {
  const [summary, recent] = await Promise.all([
    db.execute(sql`
      WITH events AS (SELECT created_at, target_id::jsonb AS data FROM audit_events WHERE action = 'gemini.request'),
      periods AS (SELECT 'today' AS name, (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo' AS start
        UNION ALL SELECT 'month', date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
      SELECT p.name, count(e.created_at)::int AS calls,
        count(e.created_at) FILTER (WHERE (e.data->>'status')::int <> 200)::int AS failures,
        count(e.created_at) FILTER (WHERE (e.data->>'status')::int = 200 AND e.data->'tokens'->>'total' IS NULL)::int AS unreported,
        sum((e.data->'tokens'->>'input')::bigint) AS input, sum((e.data->'tokens'->>'output')::bigint) AS output,
        sum((e.data->'tokens'->>'thinking')::bigint) AS thinking, sum((e.data->'tokens'->>'total')::bigint) AS total,
        (SELECT min(created_at) FROM events) AS started_at
      FROM periods p LEFT JOIN events e ON e.created_at >= p.start GROUP BY p.name
    `),
    db.select().from(auditEvents).where(eq(auditEvents.action, "gemini.request")).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(10),
  ]);
  function period(name: string): AiUsagePeriod {
    const row = summary.rows.find((r) => r.name === name);
    const value = (key: string) => row?.[key] == null ? null : Number(row[key]);
    return { calls: value("calls") ?? 0, failures: value("failures") ?? 0, unreported: value("unreported") ?? 0, input: value("input"), output: value("output"), thinking: value("thinking"), total: value("total") };
  }
  return { configured: Boolean(process.env.GEMINI_API_KEY?.trim()), models: geminiModels(),
    startedAt: summary.rows[0]?.started_at ? new Date(String(summary.rows[0].started_at)).toISOString() : null,
    today: period("today"), month: period("month"),
    recent: recent.map((r) => ({ ...JSON.parse(r.targetId) as AiRequestEvent, createdAt: r.createdAt.toISOString() })) };
}
