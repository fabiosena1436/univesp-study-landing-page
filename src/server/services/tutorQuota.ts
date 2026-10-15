import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "@/lib/errors";
import { quotaPeriod, tutorQuotaPolicy, type TutorQuotaStatus } from "@/lib/tutorQuotaPolicy";

export async function readTutorQuota(userId: string): Promise<TutorQuotaStatus> {
  const policy = tutorQuotaPolicy(), { day, resetAt } = quotaPeriod();
  const result = await db.execute(sql`SELECT key, requests, tokens FROM tutor_quotas WHERE period=${day} AND key IN ('global', ${userId})`);
  const user = result.rows.find(r => r.key === userId), global = result.rows.find(r => r.key === "global");
  const messagesUsed = Number(user?.requests ?? 0), tokensUsed = Number(user?.tokens ?? 0);
  const messagesRemaining = Math.max(0, policy.dailyMessages - messagesUsed), tokensRemaining = Math.max(0, policy.userTokens - tokensUsed);
  return { configured: Boolean(process.env.GROQ_API_KEY?.trim()), messagesUsed, messagesLimit: policy.dailyMessages, messagesRemaining,
    tokensUsed, tokensLimit: policy.userTokens, tokensRemaining, resetAt,
    sharedAvailable: Number(global?.tokens ?? 0) < policy.sharedTokens && Number(global?.requests ?? 0) < policy.sharedMessages,
    warning: messagesRemaining <= Math.ceil(policy.dailyMessages * .2) || tokensRemaining <= policy.userTokens * .2 };
}

export async function reserveTutorQuota(userId: string, input: unknown) {
  const policy = tutorQuotaPolicy(), { day, resetAt } = quotaPeriod();
  // Byte count intentionally over-reserves input, plus the output/thinking cap.
  const reserved = Buffer.byteLength(JSON.stringify(input), "utf8") + 1600;
  const retry = Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000));
  await db.transaction(async tx => {
    // All instances lock the shared row first, then the user row, in one transaction.
    for (const key of ["global", userId]) {
      await tx.execute(sql`INSERT INTO tutor_quotas (key, period) VALUES (${key}, ${day}) ON CONFLICT DO NOTHING`);
      const row = (await tx.execute(sql`SELECT requests, tokens FROM tutor_quotas WHERE key=${key} AND period=${day} FOR UPDATE`)).rows[0];
      const global = key === "global";
      if (Number(row.requests) >= (global ? policy.sharedMessages : policy.dailyMessages) || Number(row.tokens) + reserved > (global ? policy.sharedTokens : policy.userTokens)) {
        throw new ApiError(429, global ? "A reserva diária do assistente para a comunidade acabou ou não comporta esta consulta. Tente uma pergunta mais curta ou aguarde a renovação da cota do site." : "Sua cota diária do assistente acabou ou não comporta esta consulta. Reduza o histórico iniciando uma nova conversa ou aguarde a renovação. Materiais e provas continuam disponíveis.", retry);
      }
      await tx.execute(sql`UPDATE tutor_quotas SET requests=requests+1, tokens=tokens+${reserved} WHERE key=${key} AND period=${day}`);
    }
  });
  return { userId, day, reserved };
}

export async function settleTutorQuota(reservation: Awaited<ReturnType<typeof reserveTutorQuota>>, actual: number | undefined, success: boolean) {
  const tokens = typeof actual === "number" && Number.isSafeInteger(actual) && actual >= 0 ? actual : reservation.reserved;
  try {
    await db.transaction(async tx => {
      for (const key of ["global", reservation.userId]) await tx.execute(sql`UPDATE tutor_quotas SET tokens=GREATEST(0,tokens+${tokens - reservation.reserved}), requests=GREATEST(0,requests-${!success && key !== "global" ? 1 : 0}) WHERE key=${key} AND period=${reservation.day}`);
    });
  } catch { console.error(JSON.stringify({ event: "tutor.quota.settlement_failed" })); }
}
