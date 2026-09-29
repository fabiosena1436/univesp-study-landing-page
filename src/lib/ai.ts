import type { GeneratedQuestion } from "./localGen";
import { LETTERS, parseReviewText } from "./parser";

export type GenEngine = "gemini" | "local";
// Modelo Flash disponível para geração de texto na API Gemini.
const GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];

export function activeEngine(): GenEngine {
  return process.env.GEMINI_API_KEY ? "gemini" : "local";
}

const SYS_PROMPT = `Você é um professor brasileiro que cria questões objetivas de múltipla escolha a partir de material de aula.

Regras obrigatórias:
- Escreva em português do Brasil, com linguagem clara de vestibular/faculdade.
- Cada questão tem exatamente 1 enunciado, 5 alternativas (A a E) e 1 correta.
- As alternativas incorretas devem ser plausíveis, mas claramente erradas para quem estudou.
- Varie os tipos: conceitual, aplicação/caso, comparação, "assinale a incorreta", completação.
- No campo feedback explique por que a correta está certa E por que cada outra está errada (2 a 6 frases).
- Use SOMENTE informação presente no CONTEÚDO. Não invente dados, nomes ou números.
- Não copie frases literais do conteúdo no enunciado; reescreva com suas palavras.

Responda APENAS com JSON válido no formato:
{"questions":[{"statement":"...","options":[{"key":"A","text":"..."}],"correctKey":"A","feedback":"..."}]}`;

type RawQ = {
  statement?: unknown;
  question?: unknown;
  options?: unknown;
  correctKey?: unknown;
  feedback?: unknown;
};

function coerceQuestions(raw: unknown): GeneratedQuestion[] {
  const root = raw as { questions?: unknown } | unknown[] | null;
  const list = Array.isArray(root) ? root : Array.isArray(root?.questions) ? root.questions : [];
  const out: GeneratedQuestion[] = [];

  for (const item of (list as RawQ[]).slice(0, 30)) {
    if (!item || typeof item !== "object") continue;
    const statement =
      typeof item.statement === "string"
        ? item.statement.trim()
        : typeof item.question === "string"
          ? item.question.trim()
          : "";
    if (statement.length < 15) continue;

    const rawOpts = Array.isArray(item.options) ? item.options : [];
    const options = rawOpts
      .map((o, i) => {
        const ob = (o ?? {}) as { key?: unknown; text?: unknown };
        const key =
          typeof ob.key === "string" && /^[A-F]$/.test(ob.key.toUpperCase())
            ? ob.key.toUpperCase()
            : LETTERS[i];
        return { key, text: typeof ob.text === "string" ? ob.text.trim().slice(0, 1200) : "" };
      })
      .filter((o) => o.text.length > 0)
      .slice(0, 6)
      .map((o, i) => ({ ...o, key: LETTERS[i] }));

    if (options.length < 3) continue;

    const ck =
      typeof item.correctKey === "string" ? item.correctKey.trim().toUpperCase().slice(0, 1) : "";
    const correctKey = options.some((o) => o.key === ck)
      ? ck
      : options.find((o) => item.correctKey && o.text === item.correctKey)?.key ?? null;

    const feedback = typeof item.feedback === "string" ? item.feedback.trim().slice(0, 8000) : "";

    out.push({ statement: statement.slice(0, 6000), options, correctKey, feedback });
  }
  return out;
}

function chunkText(text: string, size: number, maxChunks: number): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < text.length && parts.length < maxChunks) {
    parts.push(text.slice(i, i + size));
    i += size;
  }
  return parts;
}

async function callGemini(content: string, count: number, key: string): Promise<GeneratedQuestion[]> {
  const body = {
    system_instruction: { parts: [{ text: SYS_PROMPT }] },
    contents: [
      {
        parts: [
          {
            text: `CONTEÚDO DO MATERIAL DE AULA:\n"""\n${content}\n"""\n\nGere exatamente ${count} questões de múltipla escolha cobrindo os pontos mais importantes desse conteúdo.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.75, responseMimeType: "application/json", maxOutputTokens: 8192 },
  };

  let lastError = "A IA não respondeu como esperado.";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      lastError =
        res.status === 429
          ? "A cota gratuita da IA estourou agora. Tente de novo em alguns instantes."
          : `A IA não respondeu como esperado (código ${res.status}).`;
      continue;
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) {
      lastError = "A IA retornou uma resposta vazia.";
      continue;
    }
    const questions = coerceQuestions(JSON.parse(text));
    if (questions.length > 0) return questions;
    lastError = "A IA não retornou questões em um formato válido.";
  }
  throw new Error(lastError);
}

/**
 * Gera questões a partir do material.
 * Usa Gemini quando GEMINI_API_KEY está definida; caso contrário (ou se falhar),
 * usa o gerador local gratuito que roda no próprio servidor.
 */
export async function generateQuestions(
  content: string,
  count: number,
  materialTitle: string,
): Promise<{ engine: GenEngine; questions: GeneratedQuestion[]; note: string | null }> {
  const key = process.env.GEMINI_API_KEY;
  const capped = Math.max(1, Math.min(20, count));
  const parsed = parseReviewText(content);

  // PDFs exportados da plataforma costumam trazer as questões, alternativas,
  // feedback e gabarito prontos. Nesse caso, preserve os dados em vez de
  // gerar uma questão genérica em cima do texto inteiro.
  const structured = parsed.questions.filter(
    (q) => q.statement.trim().length >= 10 && q.options.length >= 2,
  );
  if (structured.length > 0) {
    const questions = structured.slice(0, capped).map((q) => ({
      statement: q.statement,
      options: q.options,
      correctKey: q.correctKey,
      feedback: q.feedback,
    }));
    return {
      engine: "local",
      questions,
      note:
        parsed.errors.length > 0
          ? parsed.errors.join(" ")
          : "Questões existentes detectadas no material e preservadas com alternativas, gabarito e feedback.",
    };
  }

  if (key) {
    try {
      const chunks = chunkText(content, 30000, 3);
      const per = Math.max(2, Math.ceil(capped / chunks.length));
      const merged: GeneratedQuestion[] = [];
      for (const chunk of chunks) {
        const questions = await callGemini(chunk, per, key);
        merged.push(...questions);
        if (merged.length >= capped) break;
      }
      const selected = merged.slice(0, capped);
      if (selected.length > 0) {
        return { engine: "gemini", questions: selected, note: null };
      }
    } catch (e) {
      return {
        engine: "local",
        questions: [],
        note: `A IA não conseguiu gerar questões a partir deste conteúdo (${
          e instanceof Error ? e.message : "erro desconhecido"
        }). Nenhuma questão foi inventada; confira se o PDF contém texto selecionável e tente novamente.`,
      };
    }
  }

  return {
    engine: "local",
    questions: [],
    note:
      "Não encontrei questões estruturadas neste material e a IA não está configurada. Configure GEMINI_API_KEY para gerar questões novas a partir do conteúdo.",
  };
}
