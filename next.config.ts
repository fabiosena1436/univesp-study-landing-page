import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // o extrator de PDF (unpdf/pdfjs) é melhor fora do bundler do servidor
  serverExternalPackages: ["unpdf"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
