import { NextRequest } from "next/server";
import { consumeVerification } from "@/lib/emailVerification";
import { handleError, str } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    await rateLimit("verify", "global", 100, 60_000);
    const body = await req.json().catch(() => null);
    await consumeVerification(str(body?.token, 128));
    return Response.json({ message: "E-mail confirmado. Entre com sua senha para consultar seu acesso." });
  } catch (e) { return handleError(e); }
}
