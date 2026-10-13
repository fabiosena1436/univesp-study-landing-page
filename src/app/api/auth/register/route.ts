import { instrument } from "@/server/services/telemetry";
import { limitClient } from "@/lib/clientRateLimit";
import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { authorizedEmails, users } from "@/db/schema";
import { createSession, hashPassword, safeUser } from "@/lib/auth";
import { passwordError } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { ApiError, handleError, str } from "@/lib/errors";
import { EMAIL_RE, registrationEmailAllowed } from "@/lib/constants";
import { normalizeWhatsapp } from "@/lib/access";

async function handlePOST(req: NextRequest) {
  try {
    await limitClient(req, "register");
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 80);
    const email = str(body?.email, 200).toLowerCase();
    const course = str(body?.course, 120);
    const whatsapp = normalizeWhatsapp(body?.whatsapp);
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length < 2) throw new ApiError(400, "Informe seu nome (mínimo 2 letras).");
    if (!EMAIL_RE.test(email)) throw new ApiError(400, "Informe um e-mail válido.");
    if (!registrationEmailAllowed(email)) throw new ApiError(400, "Use seu e-mail institucional da UNIVESP com final @aluno.univesp.br.");
    if (!whatsapp) throw new ApiError(400, "Informe um WhatsApp brasileiro válido com DDD.");
    if (course.length < 2) throw new ApiError(400, "Informe o curso que você faz na UNIVESP.");
    const badPassword = passwordError(password);
    if (badPassword) throw new ApiError(400, badPassword);
    await rateLimit("register", "global", 100, 60_000);
    await rateLimit("register.email", email, 3, 3600000);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) throw new ApiError(409, "Esse e-mail já possui uma conta. Entre com sua senha.");

    const passwordHash = await hashPassword(password);
    const user = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('registration-approval'))`);
      const [authorized] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email)).limit(1);
      const [created] = await tx.insert(users).values({ name, email, course, whatsapp, passwordHash, accessStatus: authorized ? "approved" : "pending" }).returning();
      return created;
    });
    if (!user) throw new ApiError(500, "Não foi possível criar a conta.");

    await createSession(user.id);
    return Response.json({ user: safeUser(user) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export const POST = instrument("/api/auth/register", "POST", handlePOST);
