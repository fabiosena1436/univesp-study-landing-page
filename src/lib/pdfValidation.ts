const MAX_BYTES = 4 * 1024 * 1024;

export function pdfValidationError(filename: string, type: string, size: number): string | null {
  if (size > MAX_BYTES) return "O PDF passa de 4 MB. Divida o arquivo e envie em partes.";
  if (size === 0) return "O arquivo está vazio.";
  if (type !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) return "Só aceito arquivo PDF por aqui.";
  return null;
}
