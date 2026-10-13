import type { NextRequest } from "next/server";
import { rateLimit } from "./rateLimit";

export function clientIdentity(req: NextRequest) {
  // Only trust forwarded IPs when the platform/proxy overwrites client input.
  const value = process.env.VERCEL === "1" ? req.headers.get("x-vercel-forwarded-for")
    : process.env.TRUST_PROXY === "true" ? req.headers.get("x-forwarded-for") : null;
  const address = value?.split(",")[0].trim();
  return address && /^[a-f0-9.:]{3,64}$/i.test(address) ? address : "direct-client";
}
export async function limitClient(req: NextRequest, scope: string) {
  await rateLimit(`${scope}.client`, clientIdentity(req), scope === "login" ? 120 : scope === "register" ? 20 : 20, 60000);
}
