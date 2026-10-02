import { ApiError, isUuid } from "./errors";
import type { OptionT } from "./types";

export function uuid(value: string, message = "Identificador inválido.") {
  if (!isUuid(value)) throw new ApiError(400, message);
  return value;
}

export function passwordError(password: string): string | null {
  // bcrypt only considers the first 72 UTF-8 bytes.
  return password.length < 8 || Buffer.byteLength(password, "utf8") > 72
    ? "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes."
    : null;
}

export function validateOptions(value: unknown, correctKey: unknown, requireAnswer = false): { options: OptionT[]; correctKey: string | null } {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) throw new ApiError(400, "Use de 2 a 6 alternativas.");
  const options = value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new ApiError(400, "Alternativa inválida.");
    const { key, text } = raw as Record<string, unknown>;
    if (typeof key !== "string" || !/^[A-F]$/.test(key.toUpperCase()) || typeof text !== "string" || !text.trim() || text.length > 4000) {
      throw new ApiError(400, "Cada alternativa precisa de uma letra de A a F e texto.");
    }
    return { key: key.toUpperCase(), text: text.trim() };
  });
  if (new Set(options.map((o) => o.key)).size !== options.length) throw new ApiError(400, "As letras das alternativas devem ser únicas.");
  const answer = typeof correctKey === "string" ? correctKey.trim().toUpperCase() : null;
  if ((answer && !options.some((o) => o.key === answer)) || (requireAnswer && !answer)) throw new ApiError(400, "Selecione um gabarito válido.");
  return { options, correctKey: answer || null };
}

type GradingQuestion = { id: string; subjectId: string; correctKey: string | null; options: OptionT[] };
export function gradeAnswers(raw: unknown[], questions: GradingQuestion[], subjectId: string) {
  if (!raw.length || raw.length > 200) throw new ApiError(400, "Envie de 1 a 200 respostas.");
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  return raw.map((item) => {
    const value = item as Record<string, unknown> | null;
    const questionId = typeof value?.questionId === "string" ? value.questionId : "";
    const q = byId.get(questionId);
    if (!q || q.subjectId !== subjectId || !q.correctKey || seen.has(questionId)) throw new ApiError(400, "Questão inválida, repetida ou de outra matéria.");
    seen.add(questionId);
    const selectedKey = value?.selectedKey == null ? null : typeof value.selectedKey === "string" ? value.selectedKey.toUpperCase() : "";
    if (selectedKey !== null && !q.options.some((o) => o.key === selectedKey)) throw new ApiError(400, "Alternativa selecionada inválida.");
    return { questionId, selectedKey, isCorrect: selectedKey !== null && selectedKey === q.correctKey };
  });
}

export function pageParams(params: URLSearchParams, defaultLimit = 50) {
  const parse = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) throw new ApiError(400, "Paginação inválida.");
    return n;
  };
  return { limit: Math.max(1, Math.min(100, parse("limit", defaultLimit))), offset: parse("offset", 0) };
}
