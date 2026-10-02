import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sendVerification } from "@/lib/accountEmail";
import { handleError, str } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = str(body?.email, 200).toLowerCase();
    await rateLimit("resend", "global", 100, 60_000);
    await rateLimit("resend.email", email, 3, 3600000);
    const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
    if (user && !user.emailVerifiedAt && !user.isBlocked) {
      try { await sendVerification(user); } catch { console.error(JSON.stringify({ event: "email.verification.failed" })); }
    }
    return Response.json({ message: "Se houver uma conta pendente, enviaremos um novo link. Confira também o spam." });
  } catch (e) { return handleError(e); }
}
