import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { passwordError } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { ApiError, handleError, str } from "@/lib/errors";
import { EMAIL_RE, registrationEmailAllowed } from "@/lib/constants";
import { appUrl, sendVerification } from "@/lib/accountEmail";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 80);
    const email = str(body?.email, 200).toLowerCase();
    const course = str(body?.course, 120);
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length < 2) throw new ApiError(400, "Informe seu nome (mínimo 2 letras).");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Informe um e-mail válido.");
    if (!registrationEmailAllowed(email))
      throw new ApiError(400, "Use um e-mail @aluno.univesp.br ou um endereço autorizado pelo responsável.");
    if (course.length < 2) throw new ApiError(400, "Informe o curso que você faz na UNIVESP.");
    const badPassword = passwordError(password);
    if (badPassword) throw new ApiError(400, badPassword);
    await rateLimit("register", "global", 100, 60_000);
    await rateLimit("register.email", email, 3, 3600000);
    appUrl();
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
      throw new ApiError(503, "O envio de confirmação ainda não foi configurado.");

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) throw new ApiError(409, "Esse e-mail já possui uma conta. Entre com sua senha.");

    const rows = await db
      .insert(users)
      .values({ name, email, course, passwordHash: await hashPassword(password) })
      .returning();
    const user = rows[0];
    if (!user) throw new ApiError(500, "Não foi possível criar a conta.");

    try { await sendVerification(user); }
    catch { return Response.json({ message: "Conta criada, mas não foi possível enviar o link agora. Solicite um novo link na página de confirmação." }, { status: 201 }); }
    return Response.json({ message: "Conta criada. Confirme seu e-mail para entrar. A mensagem pode levar alguns minutos; confira também Outros e Lixo Eletrônico." }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
