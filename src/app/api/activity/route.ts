import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
import { db } from "@/db";
import { sql } from "drizzle-orm";
export async function POST() {
  try {
    const user = await requireUser();
    await rateLimit("activity.pulse", user.id, 6, 60000);
    await db.execute(sql`UPDATE users SET active_seconds=LEAST(2147483647, active_seconds::bigint + CASE WHEN last_seen_at BETWEEN now()-interval '75 seconds' AND now()-interval '40 seconds' THEN LEAST(60,EXTRACT(EPOCH FROM now()-last_seen_at)::int) ELSE 0 END), last_seen_at=now(), activity_started_at=COALESCE(activity_started_at,now()) WHERE id=${user.id}`);
    return Response.json({ ok: true });
  } catch (e) { return handleError(e); }
}
