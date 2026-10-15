import { db } from "@/db";
import { users, attempts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";
import { uuid } from "@/lib/validation";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const id = uuid((await params).id);
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, course: users.course, whatsapp: users.whatsapp,
      createdAt: users.createdAt, accessStatus: users.accessStatus, isBlocked: users.isBlocked, lastLoginAt: users.lastLoginAt,
      lastSeenAt: users.lastSeenAt, activityStartedAt: users.activityStartedAt, activeSeconds: users.activeSeconds }).from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new ApiError(404, "Usuário não encontrado.");
    const [summary, subjects, recent, progress] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS attempts, COALESCE(sum(total),0)::int AS answered, COALESCE(sum(correct_count),0)::int AS correct, COALESCE(sum(duration_sec),0)::bigint AS "examSeconds" FROM attempts WHERE user_id=${id}`),
      db.execute(sql`SELECT subject_id AS "subjectId", max(subject_name) AS "subjectName", count(*)::int AS attempts, sum(total)::int AS answered, sum(correct_count)::int AS correct FROM attempts WHERE user_id=${id} GROUP BY subject_id ORDER BY max(created_at) DESC LIMIT 50`),
      db.select({ id: attempts.id, subjectName: attempts.subjectName, total: attempts.total, correctCount: attempts.correctCount, durationSec: attempts.durationSec, createdAt: attempts.createdAt }).from(attempts).where(eq(attempts.userId, id)).orderBy(desc(attempts.createdAt), desc(attempts.id)).limit(10),
      db.execute(sql`SELECT count(*)::int AS tracked, count(*) FILTER (WHERE due_at<=now())::int AS due, count(*) FILTER (WHERE interval_days>=15)::int AS consolidated FROM study_progress WHERE user_id=${id}`),
    ]);
    return Response.json({ user, summary: summary.rows[0], subjects: subjects.rows, recent, progress: progress.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return handleError(e); }
}
