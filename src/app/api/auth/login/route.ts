import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, safeUser, verifyPassword } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { EMAIL_RE } from "@/lib/constants";

/* rate limit simples em memória: 8 tentativas / 10 min por e-mail */
const buckets = new Map<string, { count: number; resetAt: number }>();

function hitBucket(key: string): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (b && now < b.resetAt) {
    if (b.count >= 8) return true;
    b.count += 1;
    return false;
  }
  buckets.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email, 200).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!EMAIL_RE.test(email) || password.length === 0)
      throw new ApiError(400, "Informe e-mail e senha.");

    if (hitBucket(email))
      throw new ApiError(429, "Muitas tentativas. Aguarde uns 10 minutos e tente de novo.");

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    const ok = user && (await verifyPassword(password, user.passwordHash));
    if (!ok) throw new ApiError(401, "E-mail ou senha incorretos.");
    if (user.isBlocked) throw new ApiError(403, "Sua conta está bloqueada. Entre em contato com o administrador.");

    buckets.delete(email);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await createSession(user.id);
    return Response.json({ user: safeUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
