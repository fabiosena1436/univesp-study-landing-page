const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = ["application/pdf"];

/** extrai o texto de um PDF usando unpdf (grátis, roda no próprio servidor) */
export async function extractPdfText(
  buffer: Buffer,
): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  return { text: merged, pages: totalPages ?? 0 };
}

export function pdfValidationError(filename: string, type: string, size: number): string | null {
  if (size > MAX_BYTES) return "O PDF passa de 20 MB. Divida o arquivo e envie em partes.";
  if (!ALLOWED_TYPES.includes(type) && !filename.toLowerCase().endsWith(".pdf"))
    return "Só aceito arquivo PDF por aqui.";
  return null;
}

/** limpa o texto extraído: hífen de quebra de linha, espaços, cabeçalhos repetidos */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/([a-zà-ú])-\n([a-zà-ú])/g, "$1$2") // pala-\nvra -> palavra
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .join("\n")
    .trim();
}

export function guessTitleFromText(text: string, fallback: string): string {
  const first = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 6 && l.length <= 90 && /[a-zA-ZÀ-ú]/.test(l));
  return first ? first.slice(0, 80) : fallback;
}
