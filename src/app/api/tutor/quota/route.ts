import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { readTutorQuota } from "@/server/services/tutorQuota";
export async function GET() {
  try { const user = await requireUser(); return Response.json(await readTutorQuota(user.id), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return handleError(e); }
}
