import { requireAdmin } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { readAiUsage } from "@/lib/aiUsageStore";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await readAiUsage(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}
