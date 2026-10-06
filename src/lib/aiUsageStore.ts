import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { geminiModels, type AiRequestEvent, type AiUsagePeriod, type AiUsageSummary } from "./aiUsage";

// Reuse the durable event log, shared by all server instances.
export async function saveAiRequest(event: AiRequestEvent) {
  await db.insert(auditEvents).values({ action: "gemini.request", targetId: JSON.stringify(event) });
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
