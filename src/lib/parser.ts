import type { OptionT } from "./types";

export interface ParsedQuestion {
  tempId: string;
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string;
  warnings: string[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

/* ------------------------------------------------------------------ */
/* padrões do texto copiado da área de revisão (estilo Moodle)        */
/* ------------------------------------------------------------------ */

const NOISE_PATTERNS: RegExp[] = [
  /^questão\s*\d+/i,
  /^correto\s*[.:]?\s*$/i,
  /^errado\s*[.:]?\s*$/i,
  /^incorreto\s*[.:]?\s*$/i,
  /^parcialmente\s+correto\s*[.:]?\s*$/i,
  /^atingiu\s+[\d.,]+\s+de\s+[\d.,]+/i,
  /^marcar\s+questão\s*$/i,
  /^texto\s+da\s+questão\s*$/i,
  /^sua\s+resposta\s+está\s+(correta|errada|parcialmente\s+correta)\s*[.:]?\s*$/i,
  /^sua\s+resposta\s*:?\s*$/i,
  /^resposta\s+da\s+questão\s*:?\s*$/i,
  /^resposta\s+(do\s+participante|do\s+aluno)\s*:?\s*$/i,
  /^pontuação\s*:?\s*$/i,
  /^#{0,6}\s*feedback\s*:?\s*$/i,
  /^#{0,6}\s*justificativa\s*:?\s*$/i,
  /^questão\s+\d+\s*resposta/i,
];

const OPTION_RE = /^([A-Fa-f])\s*[.):\-–—]\s*(.*)$/;
const CORRECT_RE =
  /^(?:a|as)\s+resposta(?:s)?\s+correta(?:s)?\s+(?:é|são)\s*:?\s*(.*)$/i;
const FEEDBACK_RE = /^#{0,6}\s*feedback\s*:?\s*$/i;
const JUSTIFICATION_RE = /^#{0,6}\s*justificativa\s*:?\s*$/i;
const HEADER_RE = /^#{0,6}\s*Questão\s+\d+\s*(?:Resposta)?\s*$/i;
const RESPONSE_MARKER_RE = /^Questão\s+\d+\s*Resposta\b/i;
const HEADER_SIGNATURES = [
  /^correto/i,
  /^errado/i,
  /^incorreto/i,
  /^parcialmente\s+correto/i,
  /^atingiu\s+/i,
  /^marcar\s+questão/i,
  /^texto\s+da\s+questão/i,
];

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((r) => r.test(line.trim()));
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

/* ------------------------------------------------------------------ */
/* processa um bloco de questão                                       */
/* ------------------------------------------------------------------ */

function matchCorrectLetter(options: OptionT[], correctRaw: string): string | null {
  if (options.length === 0) return null;
  const target = normalizeText(correctRaw);
  if (target.length < 8) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const opt of options) {
    const t = normalizeText(opt.text);
    if (!t) continue;
    let score = 0;
    if (t === target) score = 1;
    else if (t.startsWith(target) || target.startsWith(t)) score = 0.9;
    else if (target.length >= 24 && t.slice(0, 48) === target.slice(0, 48))
      score = 0.75;
    if (score > bestScore) {
      bestScore = score;
      best = opt.key;
    }
  }
  return bestScore >= 0.75 ? best : null;
}

function processChunk(lines: string[], chunkStart: number, chunkEnd: number, idx: number): ParsedQuestion {
  const warnings: string[] = [];
  const raw = lines.slice(chunkStart, chunkEnd);

  // localiza marcadores dentro do bloco
  let feedbackIdx = -1;
  let correctIdx = -1;
  let markerIdx = -1;
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i].trim();
    if (feedbackIdx < 0 && FEEDBACK_RE.test(t)) feedbackIdx = i;
    if (correctIdx < 0 && CORRECT_RE.test(t)) correctIdx = i;
    if (markerIdx < 0 && RESPONSE_MARKER_RE.test(t)) markerIdx = i;
  }

  let correctRaw = "";
  if (correctIdx >= 0) {
    const m = raw[correctIdx].trim().match(CORRECT_RE);
    if (m) {
      const parts = m[1] ? [m[1]] : raw.slice(correctIdx + 1);
      correctRaw = parts
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/^(?:alternativa\s*)?["“']?/i, "")
        .replace(/["”']?\s*\.?$/i, "")
        .trim();
    }
  }

  const justificationParts: string[] = [];
  let feedback = "";
  if (feedbackIdx >= 0) {
    const end = correctIdx > feedbackIdx ? correctIdx : raw.length;
    feedback = raw.slice(feedbackIdx + 1, end).join("\n").trim();
  }

  // região das alternativas: depois do marcador de resposta, senão a partir da 1ª letra
  const optionsRegionStart =
    markerIdx >= 0 ? markerIdx + 1 : raw.findIndex((l) => (l.trim() ? OPTION_RE.exec(l.trim()) : false));
  const cutEnd =
    feedbackIdx >= 0 ? feedbackIdx : correctIdx >= 0 ? correctIdx : raw.length;

  const options: OptionT[] = [];
  let current: OptionT | null = null;
  let inJustification = false;
  const regionStart =
    optionsRegionStart >= 0 ? Math.max(optionsRegionStart, markerIdx + 1) : cutEnd;

  for (let i = regionStart; i < cutEnd; i++) {
    const t = raw[i].trim();
    const m = t ? OPTION_RE.exec(t) : null;
    if (m) {
      if (current) options.push(current);
      current = { key: m[1].toUpperCase(), text: m[2].trim() };
      inJustification = false;
      continue;
    }
    if (JUSTIFICATION_RE.test(t)) {
      inJustification = true;
      continue;
    }
    if (inJustification) {
      if (t) justificationParts.push(t);
      continue;
    }
    if (current && t) current.text = current.text ? `${current.text} ${t}` : t;
  }
  if (current) options.push(current);
  feedback = [...justificationParts, feedback].filter(Boolean).join("\n\n").trim();

  // enunciado: antes do marcador de resposta (ou antes da 1ª alternativa)
  const statementEnd =
    markerIdx >= 0 ? markerIdx : optionsRegionStart >= 0 ? optionsRegionStart : cutEnd;
  const statement = raw
    .slice(0, statementEnd)
    .map((l) => l.trim())
    .filter((l) => l && !isNoiseLine(l) && !RESPONSE_MARKER_RE.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const correctKey = matchCorrectLetter(options, correctRaw);

  if (statement.length < 10)
    warnings.push("Enunciado não identificado ou muito curto — confira o texto.");
  if (options.length < 2)
    warnings.push("Menos de 2 alternativas detectadas — complete manualmente.");
  if (!correctRaw) warnings.push("Resposta correta não encontrada no texto.");
  else if (!correctKey)
    warnings.push("Gabarito identificado, mas não bateu com nenhuma alternativa — clique na correta.");

  return {
    tempId: `p${idx}-${Math.random().toString(36).slice(2, 8)}`,
    statement,
    options,
    correctKey,
    feedback,
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* divide o texto em blocos de questão                                */
/* ------------------------------------------------------------------ */

function headerSignatureAhead(lines: string[], i: number): boolean {
  const window_ = lines.slice(i + 1, i + 5);
  return window_.some((l) => HEADER_SIGNATURES.some((r) => r.test(l.trim())));
}

export function parseReviewText(rawInput: string): ParseResult {
  const text = rawInput
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/^\s*#{1,6}\s*(Questão\s+\d+)/gim, "$1")
    .replace(/Questão\s+(\d+)\s*Resposta/gi, "Questão $1 Resposta")
    .replace(/Questão\s+(\d+)\s*-\s*Resposta/gi, "Questão $1 Resposta")
    .trim();
  if (!text)
    return {
      questions: [],
      errors: ["Cole primeiro o texto da área de revisão para eu analisar."],
    };

  const lines = text.split("\n");
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  const correctIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (CORRECT_RE.test(lines[i].trim())) correctIdxs.push(i);
  }

  const hasQuestao = lines.some((l) => HEADER_RE.test(l.trim()));

  // encontra os inícios de bloco
  const starts: number[] = [];
  if (hasQuestao) {
    for (let i = 0; i < lines.length; i++) {
      if (HEADER_RE.test(lines[i].trim()) && !RESPONSE_MARKER_RE.test(lines[i].trim())) {
        starts.push(i);
      }
    }
    // conteúdo antes do primeiro cabeçalho = primeira questão sem cabeçalho
    const preEnd = starts.length > 0 ? starts[0] : lines.length;
    const hasContentBefore = lines
      .slice(0, preEnd)
      .some((l) => l.trim() && !isNoiseLine(l));
    if (hasContentBefore && (starts.length === 0 || starts[0] > 0)) {
      starts.unshift(0);
    }
    if (starts.length === 0) starts.push(0);
  } else if (correctIdxs.length >= 2) {
    starts.push(0);
    for (let k = 0; k < correctIdxs.length - 1; k++) {
      const next = correctIdxs[k] + 1;
      if (lines.slice(next).some((l) => l.trim())) starts.push(next);
    }
  } else {
    starts.push(0);
  }

  // fim de cada bloco
  for (let i = 0; i < starts.length; i++) {
    let end: number;
    if (i + 1 < starts.length) end = starts[i + 1];
    else {
      // último bloco: até a linha "A resposta correta é..." (inclusa) ou fim
      const ci = correctIdxs.find((c) => c >= starts[i]);
      end = ci !== undefined ? ci + 1 : lines.length;
    }
    const q = processChunk(lines, starts[i], end, i);
    if (q.options.length >= 2) questions.push(q);
  }

  if (questions.length === 0) {
    errors.push(
      'Não identifiquei questões no texto. Verifique se a cópia veio da tela "revisão de resposta" da plataforma da faculdade, com enunciado, alternativas (A., B., C.) e feedback.',
    );
  }

  return { questions, errors };
}
