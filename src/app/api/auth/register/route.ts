import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, safeUser } from "@/lib/auth";
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
    if (password.length < 8 || password.length > 128)
      throw new ApiError(400, "A senha precisa ter pelo menos 8 caracteres.");

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) throw new ApiError(409, "Já existe uma conta com esse e-mail. Faça login.");

    const rows = await db
      .insert(users)
      .values({ name, email, course, passwordHash: await hashPassword(password) })
      .returning();
    const user = rows[0];
    if (!user) throw new ApiError(500, "Não foi possível criar a conta.");

    await createSession(user.id);
    return Response.json({ user: safeUser(user) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
