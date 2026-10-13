import { instrument } from "@/server/services/telemetry";
import { requireAccount } from "@/lib/auth";
import { issueVerification } from "@/lib/emailVerification";
import { ApiError, handleError } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";

async function handlePOST() {
  try {
    const user = await requireAccount();
    if (user.emailVerifiedAt) return Response.json({ message: "Seu e-mail já está confirmado." });
    await rateLimit("verification.user", user.id, 3, 3_600_000);
    await rateLimit("verification", "global", 100, 60_000);
    try { await issueVerification(user.id); }
    catch { throw new ApiError(503, "Não foi possível enviar o e-mail. Tente novamente mais tarde ou contate o administrador."); }
    return Response.json({ message: "Link enviado. Confira sua caixa de entrada e a pasta de spam." });
  } catch (e) { return handleError(e); }
}

export const POST = instrument("/api/auth/resend-verification", "POST", handlePOST);
