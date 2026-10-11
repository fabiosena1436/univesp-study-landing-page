import pg from "pg";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

// Credentials stay in the production build environment; never log the URL.
export function productionDatabaseUrl(env) {
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production") throw new Error("Production migrations require the Vercel production environment.");
  if (env.VERCEL_GIT_REPO_SLUG && env.VERCEL_GIT_REPO_SLUG !== "univesp-study-landing-page") throw new Error("Unexpected deployment repository.");
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new Error("Configure RESEND_API_KEY and RESEND_FROM_EMAIL before publishing signup confirmation.");
  if (!env.APP_URL || new URL(env.APP_URL).origin !== "https://univesp-study-landing-page.vercel.app") throw new Error("APP_URL must match the approved production domain.");
  const raw = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!raw) throw new Error("Production database is not configured.");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Expected PostgreSQL connection.");
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Production migration cannot target a local database.");
  // Neon direct and pooled endpoints use the same database, user and password.
  // A direct connection is needed for the advisory lock in the migration runner.
  if (url.hostname.endsWith(".neon.tech")) url.hostname = url.hostname.replace("-pooler.", ".");
  return url.href;
}

async function main() {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
    const connectionString = productionDatabaseUrl(process.env);
    const { applyMigrations } = await import("./migrate.mjs");
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, query_timeout: 60000 });
    try {
      await client.connect();
      await applyMigrations(client);
      console.log("Production database migrations completed.");
    } finally { await client.end(); }
  }
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "inherit", env: process.env });
  const code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("exit", code => resolve(code ?? 1)); });
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Production build stopped: verify email configuration, production domain, database connectivity and versioned migrations. Credentials were not logged."); process.exitCode = 1; });
}
