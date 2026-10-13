import { instrument } from "@/server/services/telemetry";
import { limitClient } from "@/lib/clientRateLimit";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, safeUser, verifyPassword } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";
import { checkLoginFailures, clearLoginFailures, recordLoginFailure, rateLimit } from "@/lib/rateLimit";
import { EMAIL_RE } from "@/lib/constants";
import { validateMfa } from "@/lib/mfa";

async function handlePOST(req: NextRequest) {
  try {
    await limitClient(req, "login");
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email, 200).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!EMAIL_RE.test(email) || password.length === 0 || Buffer.byteLength(password, "utf8") > 72)
      throw new ApiError(400, "Informe e-mail e senha.");

    await rateLimit("login", "global", 300, 60_000);
    await checkLoginFailures(email);

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    const ok = user && (await verifyPassword(password, user.passwordHash));
    if (!ok) {
      await recordLoginFailure(email);
      throw new ApiError(401, "E-mail ou senha incorretos.");
    }
    if (user.isBlocked) throw new ApiError(403, "Sua conta está bloqueada. Entre em contato com o administrador.");
    if (user.mfaSecret) {
      if (typeof body?.otp !== "string" || !body.otp.trim()) return Response.json({ mfaRequired: true });
      await rateLimit("login.mfa", user.id, 8, 120000);
      const accepted = await db.transaction(async tx => {
        const [record] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1).for("update");
        if (!record || record.isBlocked || record.passwordHash !== user.passwordHash) throw new ApiError(401, "Entre novamente com sua senha atual.");
        const update = validateMfa(record, body.otp as string);
        if (!update) return false;
        await tx.update(users).set(update).where(eq(users.id, user.id));
        return true;
      });
      if (!accepted) {
        await recordLoginFailure(email);
        throw new ApiError(401, "Código de autenticação inválido ou já utilizado.");
      }
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await createSession(user.id, Boolean(user.mfaSecret));
    await clearLoginFailures(email);
    return Response.json({ user: safeUser(user) });
  } catch (e) {
    return handleError(e);
  }
}

export const POST = instrument("/api/auth/login", "POST", handlePOST);
