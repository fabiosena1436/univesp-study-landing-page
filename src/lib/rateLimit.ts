import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "./errors";

const keyFor = (scope: string, identity: string) => createHash("sha256").update(`${scope}:${identity}`).digest("hex");
function limitError(resetAt: unknown, login = false) {
  const retryAfter = Math.max(1, Math.ceil((new Date(String(resetAt)).getTime() - Date.now()) / 1000) || 1);
  return new ApiError(429, login ? `Houve várias tentativas com senha incorreta. Tente novamente em ${retryAfter} segundos ou use “Esqueci minha senha”.` : `Muitas solicitações. Tente novamente em ${retryAfter} segundos.`, retryAfter);
}

// Failed passwords have a separate, short window. Successful logins do not consume it.
export async function checkLoginFailures(email: string) {
  const key = keyFor("login.password", email);
  const result = await db.execute(sql`SELECT count, reset_at FROM rate_limits WHERE key = ${key} AND reset_at > now()`);
  if (Number(result.rows[0]?.count) >= 8) throw limitError(result.rows[0]?.reset_at, true);
}

export async function recordLoginFailure(email: string) {
  await rateLimit("login.password", email, 8, 120_000, true);
}

export async function clearLoginFailures(email: string) {
  const key = keyFor("login.password", email);
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

// A single atomic PostgreSQL statement shares limits across processes/instances.
export async function rateLimit(scope: string, identity: string, limit: number, windowMs: number, login = false) {
  const key = keyFor(scope, identity);
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + ${windowMs} * interval '1 millisecond' ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `);
  if (Number(result.rows[0]?.count) > limit) throw limitError(result.rows[0]?.reset_at, login);
}
