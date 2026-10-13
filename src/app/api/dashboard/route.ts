import { instrument } from "@/server/services/telemetry";
import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/errors";
import { readDashboard } from "@/server/repositories/dashboard";

async function handleGET() {
  try {
    const user = await requireUser();
    return Response.json(await readDashboard(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return handleError(error); }
}

export const GET = instrument("/api/dashboard", "GET", handleGET);
