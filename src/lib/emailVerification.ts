import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authorizedEmails, emailVerificationTokens, users } from "@/db/schema";
import { createResetToken, hashResetToken } from "./passwordReset";
import { appUrl } from "./accountEmail";
import { sendAccountEmail } from "./email";
import { ApiError } from "./errors";

export async function issueVerification(userId: string) {
  const base = appUrl();
  const { token, tokenHash } = createResetToken();
  const user = await db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.isBlocked) throw new ApiError(401, "Sessão inválida.");
    if (user.emailVerifiedAt) return null;
    await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));
    await tx.insert(emailVerificationTokens).values({ userId, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    return user;
  });
  if (!user) return;
  await sendAccountEmail(user.email, "Confirme seu e-mail — Aprova UNIVESP", `${base}/confirmar-email?token=${token}`, "Confirmar meu e-mail", "Este link expira em 24 horas. A confirmação do e-mail não substitui a autorização do administrador.", "email_verification");
}

export async function consumeVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(400, "Este link é inválido ou expirou. Solicite um novo link na tela de espera.");
  await db.transaction(async tx => {
    const [candidate] = await tx.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, hashResetToken(token))).limit(1);
    if (!candidate) throw new ApiError(400, "Este link é inválido ou expirou.");
    const [user] = await tx.select().from(users).where(eq(users.id, candidate.userId)).for("update");
    if (!user || user.isBlocked) throw new ApiError(403, "Esta conta não está disponível.");
    const [used] = await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(and(eq(emailVerificationTokens.id, candidate.id), isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, new Date()))).returning();
    if (!used) throw new ApiError(400, "Este link é inválido, já foi usado ou expirou.");
    const [authorized] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, user.email)).limit(1);
    await tx.update(users).set({ emailVerifiedAt: new Date(), ...(user.accessStatus === "pending" && authorized ? { accessStatus: "approved" as const } : {}) }).where(eq(users.id, user.id));
    await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(and(eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt)));
  });
}
