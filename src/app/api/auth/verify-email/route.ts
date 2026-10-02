import { NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema";
import { hashResetToken } from "@/lib/passwordReset";
import { ApiError, handleError, str } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = str(body?.token, 128);
    if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, "Link inválido.");
    await rateLimit("verify", "global", 100, 60_000);
    await db.transaction(async (tx) => {
      const candidate = (await tx.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, hashResetToken(token))).limit(1))[0];
      if (!candidate) throw new ApiError(400, "Link inválido ou expirado.");
      await tx.select({ id: users.id }).from(users).where(eq(users.id, candidate.userId)).for("update");
      const [used] = await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(and(eq(emailVerificationTokens.id, candidate.id), isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, new Date()))).returning();
      if (!used) throw new ApiError(400, "Link inválido ou expirado.");
      await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, used.userId));
      await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.userId, used.userId));
    });
    return Response.json({ message: "E-mail confirmado. Você já pode entrar." });
  } catch (e) { return handleError(e); }
}
