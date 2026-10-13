import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts } from "@/db/schema";

export async function readDashboard(userId: string) {
  const [history, totals] = await Promise.all([
    db.select({ id: attempts.id, subjectId: attempts.subjectId, subjectName: attempts.subjectName, total: attempts.total,
      correctCount: attempts.correctCount, durationSec: attempts.durationSec, createdAt: attempts.createdAt })
      .from(attempts).where(eq(attempts.userId, userId)).orderBy(desc(attempts.createdAt), desc(attempts.id)).limit(100),
    db.select({ totalAttempts: sql<number>`count(*)::int` }).from(attempts).where(eq(attempts.userId, userId)),
  ]);
  return { attempts: history.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), totalAttempts: totals[0]?.totalAttempts ?? 0 };
}
