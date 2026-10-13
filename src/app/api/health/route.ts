import { instrument } from "@/server/services/telemetry";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { REQUIRED_MIGRATIONS } from "@/db/requiredSchema";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    const result = await db.execute(sql`select
      (select count(*)::int from app_migrations where name in (${sql.join(REQUIRED_MIGRATIONS.map(name => sql`${name}`), sql`, `)})) as migrations,
      to_regclass('public.material_files') is not null as files,
      (select count(*)::int from information_schema.columns where table_schema='public' and table_name='users' and column_name in ('is_assistant','mfa_secret')) as columns`);
    const row = result.rows[0];
    const ready = row?.migrations === REQUIRED_MIGRATIONS.length && row?.files === true && row?.columns === 2;
    return Response.json({ ok: ready, checks: { database: true, schema: ready } }, { status: ready ? 200 : 503 });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

export const GET = instrument("/api/health", "GET", handleGET);
