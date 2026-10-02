import { db } from "@/db";
import { emailVerificationTokens } from "@/db/schema";
import { createResetToken } from "./passwordReset";
import { sendAccountEmail } from "./email";
import { ApiError } from "./errors";

export function appUrl() {
  const raw = process.env.APP_URL;
  if (!raw) throw new ApiError(503, "O endereço do serviço ainda não foi configurado.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !local) throw new ApiError(503, "O serviço precisa de um endereço HTTPS.");
  return url.origin;
}

export async function sendVerification(user: { id: string; email: string }) {
  const { token, tokenHash } = createResetToken();
  const base = appUrl();
  await db.insert(emailVerificationTokens).values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) });
  await sendAccountEmail(user.email, "Confirme seu e-mail — Aprova UNIVESP", `${base}/confirmar-email?token=${token}`, "Confirmar e-mail", "O link expira em 24 horas.");
}
