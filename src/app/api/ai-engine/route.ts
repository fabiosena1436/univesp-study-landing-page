import { activeEngine } from "@/lib/ai";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ engine: activeEngine() });
  } catch (e) {
    return handleError(e);
  }
}
