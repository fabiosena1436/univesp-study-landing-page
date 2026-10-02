import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : req.nextUrl.origin;
    if ((origin && origin !== expected) || req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Origem da solicitação não permitida." }, { status: 403, headers });
    const size = Number(req.headers.get("content-length") ?? 0);
    const maxBytes = req.nextUrl.pathname === "/api/materials" ? 21 * 1024 * 1024 : 2 * 1024 * 1024;
    if (Number.isFinite(size) && size > maxBytes) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413, headers });
  }
  const response = NextResponse.next();
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
export const config = { matcher: "/api/:path*" };
