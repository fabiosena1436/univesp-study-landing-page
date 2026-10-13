import { instrument } from "@/server/services/telemetry";
import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
    return Response.json({ user });
  } catch (e) {
    return handleError(e);
  }
}

export const GET = instrument("/api/auth/me", "GET", handleGET);
