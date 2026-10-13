import { instrument } from "@/server/services/telemetry";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { createSession, requireAccount, verifyPassword } from "@/lib/auth";
import { ApiError, handleError } from "@/lib/errors";
import { encryptMfaSecret, mfaTotp, newMfaSecret, newRecoveryCodes, recoveryHash, validateMfa } from "@/lib/mfa";
import { rateLimit } from "@/lib/rateLimit";
import { audit } from "@/lib/audit";

async function handleGET() {
  try {
    const user = await requireAccount();
    return Response.json({ enabled: user.mfaEnabled, configured: /^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY ?? "") }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}
async function handlePOST(req: NextRequest) {
  try {
    const user = await requireAccount();
    await rateLimit("mfa.manage", user.id, 8, 600000);
    const body = await req.json().catch(() => null);
    const result = await db.transaction(async tx => {
      const [record] = await tx.select().from(users).where(eq(users.id, user.id)).limit(1).for("update");
      if (!record || typeof body?.password !== "string" || Buffer.byteLength(body.password, "utf8") > 72 || !(await verifyPassword(body.password, record.passwordHash))) throw new ApiError(400, "Confirme sua senha atual.");
      if (body.action === "setup") {
        if (record.mfaSecret) throw new ApiError(409, "A proteção em duas etapas já está ativa.");
        const secret = newMfaSecret();
        await tx.update(users).set({ mfaPendingSecret: encryptMfaSecret(secret), mfaPendingExpiresAt: new Date(Date.now() + 600000) }).where(eq(users.id, user.id));
        return { secret, uri: mfaTotp(secret, record.email).toString() };
      }
      if (body.action === "enable") {
        if (!record.mfaPendingSecret || !record.mfaPendingExpiresAt || record.mfaPendingExpiresAt.getTime() < Date.now()) throw new ApiError(400, "A configuração expirou. Comece novamente.");
        const pending = { ...record, mfaSecret: record.mfaPendingSecret, mfaLastUsedStep: null };
        const accepted = validateMfa(pending, String(body.code ?? ""));
        if (!accepted || !("mfaLastUsedStep" in accepted)) throw new ApiError(400, "Código do aplicativo autenticador inválido.");
        const recoveryCodes = newRecoveryCodes();
        await tx.update(users).set({ mfaSecret: record.mfaPendingSecret, mfaPendingSecret: null, mfaPendingExpiresAt: null, ...accepted, mfaRecoveryHashes: recoveryCodes.map(recoveryHash) }).where(eq(users.id, user.id));
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await audit(user.id, "user.mfa.enable", user.id, tx);
        return { enabled: true, recoveryCodes };
      }
      if (body.action === "disable") {
        if (user.isAdmin && process.env.MFA_REQUIRE_ADMIN === "true") throw new ApiError(403, "A proteção em duas etapas é obrigatória para administradores.");
        if (!validateMfa(record, String(body.code ?? ""))) throw new ApiError(400, "Informe um código válido do autenticador ou de recuperação.");
        await tx.update(users).set({ mfaSecret: null, mfaPendingSecret: null, mfaPendingExpiresAt: null, mfaLastUsedStep: null, mfaRecoveryHashes: [] }).where(eq(users.id, user.id));
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await audit(user.id, "user.mfa.disable", user.id, tx);
        return { enabled: false };
      }
      throw new ApiError(400, "Operação de segurança inválida.");
    });
    if ("enabled" in result) await createSession(user.id, result.enabled === true);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}

export const GET = instrument("/api/account/mfa", "GET", handleGET);

export const POST = instrument("/api/account/mfa", "POST", handlePOST);
