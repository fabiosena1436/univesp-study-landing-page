import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { createResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { handleError, str } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = str(body?.email, 200).toLowerCase();
    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (user) {
      const { token, tokenHash } = createResetToken();
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });
      const base = process.env.APP_URL ?? req.nextUrl.origin;
      await sendPasswordResetEmail(user.email, `${base}/redefinir-senha?token=${token}`);
    }
    return Response.json({ message: "Se o e-mail estiver cadastrado, enviaremos um link de recuperação." });
  } catch (e) {
    return handleError(e);
  }
}
