import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: ".env.local", quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect(); await client.query("BEGIN");
  for (const table of ["sessions", "password_reset_tokens", "email_verification_tokens"]) await client.query(`DELETE FROM ${table} WHERE expires_at < now()`);
  await client.query("DELETE FROM rate_limits WHERE reset_at < now()");
  await client.query("DELETE FROM audit_events WHERE created_at < now() - interval '90 days'");
  await client.query("COMMIT"); console.log("Expired sessions, tokens, limits and old audit events removed.");
} catch (e) { await client.query("ROLLBACK"); console.error(e.message); process.exitCode = 1; }
finally { await client.end(); }
