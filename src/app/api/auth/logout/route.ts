import { instrument } from "@/server/services/telemetry";
import { destroySession } from "@/lib/auth";
import { handleError } from "@/lib/errors";

async function handlePOST() {
  try {
    await destroySession();
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}

export const POST = instrument("/api/auth/logout", "POST", handlePOST);
