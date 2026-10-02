import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, safeUser, verifyPassword } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
import { EMAIL_RE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email, 200).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!EMAIL_RE.test(email) || password.length === 0 || Buffer.byteLength(password, "utf8") > 72)
      throw new ApiError(400, "Informe e-mail e senha.");

    await rateLimit("login", "global", 300, 60_000);
    await rateLimit("login.email", email, 8, 600_000);

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    const ok = user && (await verifyPassword(password, user.passwordHash));
    if (!ok) throw new ApiError(401, "E-mail ou senha incorretos.");
    if (user.isBlocked) throw new ApiError(403, "Sua conta está bloqueada. Entre em contato com o administrador.");

    if (!user.emailVerifiedAt) throw new ApiError(403, "Confirme seu e-mail antes de entrar. Solicite um link em /confirmar-email.");
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await createSession(user.id);
    return Response.json({ user: safeUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
