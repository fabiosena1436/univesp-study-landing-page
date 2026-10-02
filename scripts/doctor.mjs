import dotenv from "dotenv";
import pg from "pg";
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
  const verified = Boolean((await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified_at'")).rows.length);
  console.log(JSON.stringify({ databaseConnected: true, migrationsRecorded: migrated, upgradedSchema: verified }));
  if (!verified || !migrated) process.exitCode = 1;
} catch (e) { console.log(JSON.stringify({ databaseConnected: false, code: e.code ?? "unknown" })); process.exitCode = 1; }
finally { await client.end(); }
