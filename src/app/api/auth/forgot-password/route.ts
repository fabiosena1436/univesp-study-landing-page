import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { createResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { appUrl } from "@/lib/accountEmail";
import { rateLimit } from "@/lib/rateLimit";
import { handleError, str } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email, 200).toLowerCase();
    await rateLimit("forgot", "global", 100, 60_000);
    await rateLimit("forgot.email", email, 3, 3600000);
    const base = appUrl();
    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (user) {
      const { token, tokenHash } = createResetToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      try { await sendPasswordResetEmail(user.email, `${base}/redefinir-senha?token=${token}`); }
      catch { console.error(JSON.stringify({ event: "email.reset.failed", at: new Date().toISOString() })); }
    }
    return Response.json({ message: "Se o e-mail estiver cadastrado, enviaremos um link de recuperação." });
  } catch (e) {
    return handleError(e);
  }
}
