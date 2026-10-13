import { instrument } from "@/server/services/telemetry";
import { activeEngine } from "@/lib/ai";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function handleGET() {
  try {
    return Response.json({ engine: activeEngine() });
  } catch (e) {
    return handleError(e);
  }
}

export const GET = instrument("/api/ai-engine", "GET", handleGET);
