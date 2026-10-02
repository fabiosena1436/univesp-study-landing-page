import { NextRequest } from "next/server";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { hashResetToken } from "@/lib/passwordReset";
import { passwordError } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { ApiError, handleError, str } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const token = str(body?.token, 128);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!/^[a-f0-9]{64}$/.test(token) || passwordError(password))
      throw new ApiError(400, passwordError(password) ?? "Link inválido.");
    await rateLimit("reset", "global", 100, 60_000);
    const passwordHash = await hashPassword(password);
    await db.transaction(async (tx) => {
      const candidate = (await tx.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, hashResetToken(token))).limit(1))[0];
      if (!candidate) throw new ApiError(400, "Este link é inválido ou expirou.");
      await tx.select({ id: users.id }).from(users).where(eq(users.id, candidate.userId)).for("update");
      const [row] = await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.id, candidate.id), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).returning();
      if (!row) throw new ApiError(400, "Este link é inválido ou expirou.");
      await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
      await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.userId, row.userId));
      await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    });
    return Response.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
