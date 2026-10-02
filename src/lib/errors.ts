export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function handleError(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const requestId = crypto.randomUUID();
  const error = e as { code?: string; name?: string };
  if (error?.code === "23505") return Response.json({ error: "Este registro já existe." }, { status: 409 });
  if (error?.code === "22P02") return Response.json({ error: "Identificador inválido." }, { status: 400 });
  // Do not log queries, personal data, or provider credentials from raw errors.
  console.error(JSON.stringify({ event: "api.error", requestId, name: error?.name ?? "Error", code: error?.code ?? "unknown", at: new Date().toISOString() }));
  return Response.json(
    { error: "Erro inesperado. Tente novamente.", requestId },
    { status: 500 },
  );
}

export function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** evita erro de cast do Postgres quando o id da rota não é um uuid */
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
