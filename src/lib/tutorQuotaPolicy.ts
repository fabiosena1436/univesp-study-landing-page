export function tutorQuotaPolicy(env: NodeJS.ProcessEnv = process.env) {
  const value = (key: string, fallback: number, max: number) => {
    const n = Number(env[key] ?? fallback);
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(`Invalid ${key}`);
    return n;
  };
  return {
    dailyMessages: value("AI_TUTOR_DAILY_MESSAGES", 20, 500),
    userTokens: value("AI_TUTOR_USER_DAILY_TOKENS", 20000, 10000000),
    sharedTokens: value("AI_TUTOR_SHARED_DAILY_TOKENS", 180000, 100000000),
    sharedMessages: value("AI_TUTOR_SHARED_DAILY_MESSAGES", 900, 1000000),
  };
}
export function quotaPeriod(now = new Date()) {
  return { day: now.toISOString().slice(0, 10), resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString() };
}
export type TutorQuotaStatus = {
  configured: boolean; messagesUsed: number; messagesLimit: number; messagesRemaining: number;
  tokensUsed: number; tokensLimit: number; tokensRemaining: number; sharedAvailable: boolean;
  resetAt: string; warning: boolean;
};
