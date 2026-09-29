import { destroySession } from "@/lib/auth";
import { handleError } from "@/lib/errors";

export async function POST() {
  try {
    await destroySession();
    return new Response(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}
