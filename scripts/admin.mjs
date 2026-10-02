import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: ".env.local", quiet: true });
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.endsWith("@aluno.univesp.br")) throw new Error("Usage: npm run db:admin -- user@aluno.univesp.br (confirm ownership before promoting)");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect(); await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('aprova-admin-management'))");
  const user = (await client.query("SELECT id, email_verified_at FROM users WHERE email=$1 FOR UPDATE", [email])).rows[0];
  if (!user) throw new Error("Register and confirm this institutional email first.");
  if (!user.email_verified_at) throw new Error("Email must be confirmed before promotion.");
  await client.query("INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [user.id]);
  await client.query("INSERT INTO audit_events (actor_id, action, target_id) VALUES ($1, 'admin.promote.cli', $1)", [user.id]);
  await client.query("COMMIT"); console.log("Administrator promoted.");
} catch (e) { await client.query("ROLLBACK"); console.error(e.message); process.exitCode = 1; }
finally { await client.end(); }
