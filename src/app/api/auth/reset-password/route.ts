import { NextRequest } from "next/server";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { hashResetToken } from "@/lib/passwordReset";
import { ApiError, handleError, str } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const token = str(body?.token, 128);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!token || password.length < 8 || password.length > 128)
      throw new ApiError(400, "Informe uma senha com pelo menos 8 caracteres.");
    const row = (await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, hashResetToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1))[0];
    if (!row) throw new ApiError(400, "Este link é inválido ou expirou.");
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await db.delete(sessions).where(eq(sessions.userId, row.userId));
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
