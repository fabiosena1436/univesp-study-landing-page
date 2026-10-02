import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { parseReviewText } from "@/lib/parser";
import { ApiError, handleError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    await rateLimit("parse", user.id, 20, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) throw new ApiError(400, "Nada para analisar. Cole o texto primeiro.");
    if (text.length > 300000)
      throw new ApiError(400, "Texto muito grande (máximo 300 mil caracteres). Divida em partes.");

    const result = parseReviewText(text);
    return Response.json(result);
  } catch (e) {
    return handleError(e);
  }
}
