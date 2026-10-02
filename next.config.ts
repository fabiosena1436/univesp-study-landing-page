import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
  // o extrator de PDF (unpdf/pdfjs) é melhor fora do bundler do servidor
  serverExternalPackages: ["unpdf"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
