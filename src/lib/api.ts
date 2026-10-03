export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: (() => {
      const headers = new Headers(init?.headers);
      if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return headers;
    })(),
    credentials: "same-origin",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const p = window.location.pathname;
    if (p === "/app" || p.startsWith("/app/")) {
      window.location.href = "/entrar";
      throw new ApiClientError(401, "Sessão expirada. Entre novamente.");
    }
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiClientError(res.status, body.error || "Algo deu errado.");
  return body as T;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function clearQuizDrafts(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("aprova:quiz:")) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be unavailable. */ }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }) +
    " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
