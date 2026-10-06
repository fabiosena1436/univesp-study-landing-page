import { ApiError } from "./errors";

export function appUrl() {
  const raw = process.env.APP_URL;
  if (!raw) throw new ApiError(503, "O endereço do serviço ainda não foi configurado.");
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !local) throw new ApiError(503, "O serviço precisa de um endereço HTTPS.");
  return url.origin;
}
