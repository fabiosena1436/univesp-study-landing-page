import type { OptionT } from "./types";
import { LETTERS } from "./parser";

/* ------------------------------------------------------------------ */
/* utilidades de linguagem (pt-BR)                                    */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  `a o as os um uma uns umas de do da dos das em no na nos nas por para pelo pela pelos pelas com sem sob sobre entre até após ante contra desde perante trás e ou mas porém todavia contudo entretanto que se como quando onde quais qual quem cujo cuja cujos cujas seja sejam são é foi eram sera será estar estar estar tem ter têm tinha haver haver existe existem pode podem deve devem faz fazem vai vão seja sendo esse essa este esta isto aquilo aqueles aquelas isso seu sua seus suas meu minha nosso nossa vosso suas mais menos muito muita muitos muitas pouco pouca poucos poucas já não sim também tam bem ainda apenas somente só tal todos todas todo toda cada outro outra outros outras mesmo mesma mesmos mesmas talvez quiz quaisquer qualquer alguma alguns algumas nenhum nenhuma aqui ali lá aquela aquele depois antes durante enquanto pois porque porquanto então assim dessa deste neste naquele desses dessas destes destas naqueles daquela aquilo lhe lhes me te nos vos consigo` 
    .split(/\s+/)
    .filter(Boolean),
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stem(w: string): string {
  const s = stripAccents(w.toLowerCase());
  if (s.length <= 4) return s;
  return s
    .replace(/(ções|ções|ncias|ncia|dade|dades|ismo|ismos|mente|ável|ível|ência|encia)$/, "")
    .replace(/(es|s)$/, "");
}

function isWord(w: string): boolean {
  return /^[a-zA-ZÀ-ú]{4,}$/.test(w);
}

export function words(text: string): string[] {
  return text.split(/[^a-zA-ZÀ-ú0-9]+/).filter(Boolean);
}

function isContentWord(w: string): boolean {
  return isWord(w) && !STOPWORDS.has(stripAccents(w.toLowerCase()));
}

/** heurística: parece verbo (infinitivo, gerúndio ou particípio) */
function verbish(w: string): boolean {
  const s = stripAccents(w.toLowerCase());
  return /(?:ar|er|ir|ando|endo|indo|ado|ido|ando)$/.test(s) && s.length >= 5;
}

/* ------------------------------------------------------------------ */
/* segmentação                                                        */
/* ------------------------------------------------------------------ */

export type Sentence = { text: string; score: number; terms: string[] };

export function splitSentences(text: string): string[] {
  const flat = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const parts = flat.split(/(?<=[.!?;:])\s+/);
  const out: string[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (s.length >= 50 && s.length <= 380) out.push(s);
  }
  return out;
}

function sentenceScore(s: string, tf: Map<string, number>): { score: number; terms: string[] } {
  const ws = words(s);
  const uniq = new Set<string>();
  let score = 0;
  for (const w of ws) {
    if (!isContentWord(w)) continue;
    const k = stem(w);
    if (uniq.has(k)) continue;
    uniq.add(k);
    score += Math.min(tf.get(k) ?? 1, 4);
  }
  const digits = (s.match(/\d/g) ?? []).length;
  if (digits > ws.length * 0.25) score *= 0.4; // muita número, pouco conteúdo
  if (/(http|www\.|@)/i.test(s)) score *= 0.2;
  const terms = [...uniq]
    .map((k) => (ws.find((w) => stem(w) === k) ?? k))
    .filter((t) => t.length >= 5)
    .slice(0, 12);
  return { score: score / Math.sqrt(Math.max(6, ws.length)), terms };
}

/* ------------------------------------------------------------------ */
/* escolha de distratores                                             */
/* ------------------------------------------------------------------ */

function pickDistractors(
  correct: string,
  pool: string[],
  n: number,
  avoid: Set<string>,
): string[] {
  const cStem = stem(correct);
  const cLen = correct.length;
  const cVerb = verbish(correct);
  const scored = pool
    .filter(
      (p) =>
        p !== correct &&
        stem(p) !== cStem &&
        !avoid.has(stem(p)) &&
        verbish(p) === cVerb, // distrator da mesma classe gramatical
    )
    .map((p) => ({ p, d: Math.abs(p.length - cLen) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.p);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of scored) {
    const k = stem(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= n) break;
  }
  return out;
}

function buildOptions(correct: string, distractors: string[]): OptionT[] {
  const items = [correct, ...distractors];
  // embaralha determinístico-ish
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const correctIdx = items.indexOf(correct);
  return items.map((text, i) => ({ key: LETTERS[i], text }));
}

/* ------------------------------------------------------------------ */
/* gerador principal                                                  */
/* ------------------------------------------------------------------ */

export type GeneratedQuestion = {
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string;
};

export function generateFromMaterial(
  content: string,
  wanted: number,
  materialTitle: string,
): GeneratedQuestion[] {
  const sentences = splitSentences(content);
  if (sentences.length < 2) return [];

  // frequência dos radicais
  const tf = new Map<string, number>();
  for (const w of words(content)) {
    if (!isContentWord(w)) continue;
    const k = stem(w);
    tf.set(k, (tf.get(k) ?? 0) + 1);
  }

  const scored = sentences
    .map((s) => ({ s, ...sentenceScore(s, tf) }))
    .sort((a, b) => b.score - a.score);

  // pool de termos-chave: palavras de 5+ letras, com presença média no texto
  const keyPool = [...tf.entries()]
    .filter(([, f]) => f >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => {
      const surface =
        words(content).find((w) => stem(w) === k && w.length >= 5) ?? k;
      return surface;
    })
    .filter((w, i, arr) => arr.findIndex((x) => stem(x) === stem(w)) === i);

  const allTerms = keyPool.slice(0, 60);
  const out: GeneratedQuestion[] = [];
  const usedSentences = new Set<string>();

  const push = (q: GeneratedQuestion) => {
    const sig = stem(q.statement).slice(0, 70);
    if (out.some((x) => stem(x.statement).slice(0, 70) === sig)) return;
    if (q.options.length < 4) return;
    out.push(q);
  };

  /* ---- tipo 1: lacuna conceitual ---- */
  for (const cand of scored) {
    if (out.length >= wanted) break;
    if (usedSentences.has(cand.s)) continue;
    const nouns = cand.terms.filter((t) => t.length >= 5 && !verbish(t));
    const best = (nouns.length > 0 ? nouns : cand.terms.filter((t) => t.length >= 5)).sort(
      (a, b) => b.length - a.length,
    )[0];
    if (!best) continue;
    const re = new RegExp(`\\b${best.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "i");
    if (!re.test(cand.s)) continue;
    const distractors = pickDistractors(best, allTerms, 3, new Set());
    if (distractors.length < 3) continue;
    const blanked = cand.s.replace(re, "______");
    const options = buildOptions(best, distractors);
    push({
      statement: `Complete a lacuna conforme o material "${materialTitle}":\n\n${blanked}`,
      options,
      correctKey: options.find((o) => o.text === best)?.key ?? null,
      feedback: `O material apresenta o termo "${best}" exatamente neste contexto: "${cand.s}"\n\nAs demais alternativas são termos do mesmo conteúdo que não se encaixam nessa frase.`,
    });
    usedSentences.add(cand.s);
  }

  /* ---- tipo 2: definição ("X é Y") ---- */
  const defRe =
    /^(?:[A-ZÀ-Ú][\wÀ-ú]*(?:\s+[\wÀ-ú]+){0,3})\s+(?:é|são|significa|consiste em|refere-se a|trata-se de)\s+(.{25,240})$/i;
  for (const cand of scored) {
    if (out.length >= wanted) break;
    if (usedSentences.has(cand.s)) continue;
    const m = cand.s.match(defRe);
    if (!m) continue;
    const subject = m[0].slice(0, m[0].length - m[1].length).replace(/\s+(é|são|significa|consiste em|refere-se a|trata-se de)\s*$/i, "").trim();
    const predicate = m[1].replace(/[.;]$/, "").trim();
    if (subject.length < 4 || predicate.length < 25) continue;
    const others = scored
      .filter((c) => c.s !== cand.s)
      .map((c) => {
        const om = c.s.match(defRe);
        return om ? om[1].replace(/[.;]$/, "").trim() : null;
      })
      .filter((x): x is string => !!x && x.length >= 25 && x !== predicate);
    const distractors = pickDistractors(predicate, others, 3, new Set());
    if (distractors.length < 3) continue;
    const options = buildOptions(predicate, distractors);
    push({
      statement: `De acordo com o material "${materialTitle}", como ${subject} pode ser definido?`,
      options,
      correctKey: options.find((o) => o.text === predicate)?.key ?? null,
      feedback: `O material define: "${cand.s}"\n\nAs demais alternativas foram retiradas de outras definições do mesmo conteúdo, por isso não respondem a essa pergunta.`,
    });
    usedSentences.add(cand.s);
  }

  /* ---- tipo 3: afirmação correta (distratores com sujeito trocado) ---- */
  for (const cand of scored) {
    if (out.length >= wanted) break;
    if (usedSentences.has(cand.s)) continue;
    const term = cand.terms.filter((t) => t.length >= 5).sort((a, b) => b.length - a.length)[0];
    if (!term) continue;
    const pool = scored
      .filter(
        (c) =>
          c.s !== cand.s &&
          !usedSentences.has(c.s) &&
          c.terms.some((t) => stem(t) !== stem(term)) &&
          c.s.length >= 70,
      )
      .slice(0, 12);
    const distractors: string[] = [];
    for (const other of pool) {
      const otherTerm =
        other.terms.filter((t) => stem(t) !== stem(term)).sort((a, b) => b.length - a.length)[0] ?? null;
      if (!otherTerm) continue;
      const swapped = other.s.replace(
        new RegExp(`\\b${otherTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*\\b`, "i"),
        term,
      );
      if (swapped === other.s) continue;
      distractors.push(swapped);
      if (distractors.length >= 3) break;
    }
    if (distractors.length < 3) continue;
    const options = buildOptions(cand.s, distractors);
    push({
      statement: `Analise as afirmações a seguir com base no material "${materialTitle}" e assinale a que está de acordo com o conteúdo apresentado.`,
      options,
      correctKey: "A",
      feedback: `A alternativa correta reproduz a ideia apresentada no material: "${cand.s}"\n\nAs demais alternativas misturam trechos do conteúdo com termos de outros trechos, formando afirmações que o material não sustenta.`,
    });
    usedSentences.add(cand.s);
  }

  return out.slice(0, wanted);
}
