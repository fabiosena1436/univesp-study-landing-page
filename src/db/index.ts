import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};
const configuredMax = Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 3 : 10));
if (!Number.isInteger(configuredMax) || configuredMax < 1 || configuredMax > 100) throw new Error("DB_POOL_MAX must be an integer between 1 and 100");
const pooledNeon = new URL(databaseUrl).hostname.includes("-pooler.");

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: configuredMax,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 5000,
    query_timeout: 15000,
    // Transaction pooling cannot depend on session-specific startup settings.
    ...(pooledNeon ? {} : { statement_timeout: 15000, options: "-c timezone=UTC" }),
  });

if (process.env.VERCEL && !globalForDb.__arenaNextJsPostgresqlPool) attachDatabasePool(pool);
pool.on("error", () => console.error(JSON.stringify({ event: "database.idle_connection_error" })));

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
