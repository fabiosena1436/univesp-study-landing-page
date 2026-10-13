import { instrument } from "@/server/services/telemetry";
import { requireAdmin } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { readAiUsage } from "@/lib/aiUsageStore";

export const dynamic = "force-dynamic";
async function handleGET() {
  try {
    await requireAdmin();
    return Response.json(await readAiUsage(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}

export const GET = instrument("/api/admin/ai-usage", "GET", handleGET);
