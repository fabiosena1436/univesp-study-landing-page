import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { passwordError } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { appUrl, sendVerification } from "@/lib/accountEmail";
import { ApiError, handleError, str } from "@/lib/errors";
import { EMAIL_RE, UNIVESP_STUDENT_EMAIL_RE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 80);
    const email = str(body?.email, 200).toLowerCase();
    const course = str(body?.course, 120);
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length < 2) throw new ApiError(400, "Informe seu nome (mínimo 2 letras).");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Informe um e-mail válido.");
    if (!UNIVESP_STUDENT_EMAIL_RE.test(email))
      throw new ApiError(400, "O cadastro aceita somente e-mails institucionais @aluno.univesp.br.");
    if (course.length < 2) throw new ApiError(400, "Informe o curso que você faz na UNIVESP.");
    const badPassword = passwordError(password);
    if (badPassword) throw new ApiError(400, badPassword);
    await rateLimit("register", "global", 100, 60_000);
    await rateLimit("register.email", email, 3, 3600000);
    appUrl();
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) throw new ApiError(503, "O envio de confirmação ainda não foi configurado.");

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) return Response.json({ message: "Se o endereço puder ser cadastrado, você receberá um e-mail. Para uma conta existente, entre ou solicite novo link em /confirmar-email." });

    const rows = await db
      .insert(users)
      .values({ name, email, course, passwordHash: await hashPassword(password) })
      .returning();
    const user = rows[0];
    if (!user) throw new ApiError(500, "Não foi possível criar a conta.");

    try { await sendVerification(user); }
    catch { console.error(JSON.stringify({ event: "email.verification.failed", at: new Date().toISOString() })); }
    return Response.json({ message: "Cadastro recebido. Confirme seu e-mail para entrar. Se o link não chegar, solicite outro na página de confirmação." }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
