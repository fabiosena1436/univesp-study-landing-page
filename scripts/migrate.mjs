import dotenv from "dotenv";
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { questionFingerprint } from "../src/lib/fingerprint.ts";
import { migrationDatabaseUrl } from "./database-url.mjs";
dotenv.config({ path: ".env.local", quiet: true });

export async function applyMigrations(client, { adoptLegacy = false } = {}) {
  await client.query("SELECT pg_advisory_lock(hashtext('aprova-migrations'))");
  try {
    await client.query("CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const names = (await readdir("migrations")).filter((n) => n.endsWith(".sql")).sort();
    for (const name of names) {
      const source = await readFile(`migrations/${name}`, "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const applied = (await client.query("SELECT checksum FROM app_migrations WHERE name = $1", [name])).rows[0];
      if (applied) { if (applied.checksum !== checksum) throw new Error(`Migration checksum differs: ${name}`); continue; }
      const legacy = name === names[0] && (await client.query("SELECT to_regclass('public.users') AS table_name")).rows[0].table_name;
      if (legacy && !adoptLegacy) throw new Error("Existing database: back it up, then use npm run db:migrate -- --adopt-legacy.");
      if (legacy) {
        const baseline = JSON.parse(await readFile("migrations/meta/0000_snapshot.json", "utf8"));
        for (const table of Object.values(baseline.tables)) {
          const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table.name])).rows.map((r) => r.column_name);
          if (Object.keys(table.columns).some((c) => !columns.includes(c))) throw new Error(`Legacy table differs from baseline: ${table.name}`);
        }
        const upgraded = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email_verified_at'")).rows.length;
        if (upgraded) throw new Error("Database already modified outside versioned migrations. Inspect it before adopting.");
      }
      await client.query("BEGIN");
      try {
        if (!legacy) await client.query(source);
        if (name === "0001_reliability.sql") {
          const rows = (await client.query("SELECT id, subject_id, statement, options, correct_key FROM questions WHERE archived_at IS NULL ORDER BY id")).rows;
          const seen = new Set();
          for (const q of rows) {
            const fingerprint = questionFingerprint(q.statement, q.options, q.correct_key);
            const key = q.subject_id + fingerprint;
            // Preserve legacy duplicate content, but give its canonical representative a hash to prevent new duplicates.
            if (seen.has(key)) continue;
            seen.add(key);
            await client.query("UPDATE questions SET fingerprint=$1 WHERE id=$2", [fingerprint, q.id]);
          }
        }
        await client.query("INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
        await client.query("COMMIT");
        console.log(`${legacy ? 'Adopted' : 'Applied'} ${name}`);
      } catch (error) { await client.query("ROLLBACK"); throw error; }
    }
  } finally { await client.query("SELECT pg_advisory_unlock(hashtext('aprova-migrations'))"); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const client = new pg.Client({ connectionString: migrationDatabaseUrl(), connectionTimeoutMillis: 15000 });
  try { await client.connect(); await applyMigrations(client, { adoptLegacy: process.argv.includes("--adopt-legacy") }); }
  catch (e) { console.error(e instanceof Error ? e.message : "Migration failed"); process.exitCode = 1; }
  finally { await client.end(); }
}
