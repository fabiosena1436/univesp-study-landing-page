import dotenv from "dotenv";
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
dotenv.config({ path: ".env.local", quiet: true });
const configured = Object.fromEntries(["DATABASE_URL", "APP_URL", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "GEMINI_API_KEY"].map(key => [key, Boolean(process.env[key])]));
console.log(JSON.stringify({ configured }));
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  console.log(JSON.stringify({ databaseHost: url.hostname, databasePort: url.port || "5432", databaseName: url.pathname.slice(1) }));
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const migrated = Boolean((await client.query("SELECT to_regclass('public.app_migrations') as name")).rows[0].name);
  const expected = (await readdir("migrations")).filter(name => name.endsWith(".sql")).sort();
  const rows = migrated ? (await client.query("SELECT name,checksum FROM app_migrations")).rows : [];
  const missing = expected.filter(name => !rows.some(row => row.name === name));
  const changed = [];
  for (const name of expected) {
    const row = rows.find(row => row.name === name);
    if (row && row.checksum !== createHash("sha256").update(await readFile("migrations/" + name, "utf8")).digest("hex")) changed.push(name);
  }
  const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('email_verified_at','is_assistant','mfa_secret')")).rows;
  const files = Boolean((await client.query("SELECT to_regclass('public.material_files') AS name")).rows[0].name);
  const ready = migrated && missing.length === 0 && changed.length === 0 && columns.length === 3 && files;
  console.log(JSON.stringify({ databaseConnected: true, migrationsRecorded: migrated, upgradedSchema: ready, missingMigrations: missing, changedMigrations: changed, pdfStorageReady: files, mfaEncryptionConfigured: /^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY ?? "") }));
  if (!ready) process.exitCode = 1;
} catch (e) { console.log(JSON.stringify({ databaseConnected: false, code: e.code ?? "unknown" })); process.exitCode = 1; }
finally { await client.end(); }
