import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "./errors";

// A single atomic PostgreSQL statement shares limits across processes/instances.
export async function rateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const key = createHash("sha256").update(`${scope}:${identity}`).digest("hex");
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + ${windowMs} * interval '1 millisecond' ELSE rate_limits.reset_at END
    RETURNING count
  `);
  if (Number(result.rows[0]?.count) > limit) throw new ApiError(429, "Muitas solicitações. Aguarde e tente novamente.");
}
