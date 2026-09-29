import { getSessionUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Sessão inválida." }, { status: 401 });
    return Response.json({ user });
  } catch (e) {
    return handleError(e);
  }
}
