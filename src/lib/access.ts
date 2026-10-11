import { EMAIL_RE } from "./constants";

export function canStudy(user: { isAdmin?: boolean; accessStatus?: string; emailVerifiedAt?: unknown }) {
  return Boolean(user.isAdmin || (user.accessStatus === "approved" && user.emailVerifiedAt));
}

export function normalizeWhatsapp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40 || !/^[\d\s()+.-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!/^55[1-9]\d[2-9]\d{7,8}$/.test(digits)) return null;
  return digits;
}

export function parseAuthorizedEmails(value: unknown) {
  if (typeof value !== "string" || value.length > 100_000) throw new Error("Cole até 500 e-mails por vez.");
  const entries = value.split(/[\s,;]+/).filter(Boolean).map(email => email.toLowerCase());
  if (!entries.length || entries.length > 500) throw new Error("Informe de 1 a 500 e-mails por vez.");
  const invalid = entries.filter(email => email.length > 200 || !EMAIL_RE.test(email));
  if (invalid.length) throw new Error(`Corrija os e-mails inválidos: ${invalid.slice(0, 5).join(", ")}`);
  return [...new Set(entries)];
}

export function whatsappApprovalUrl(phone: string | null, name: string, base: string) {
  if (!phone || normalizeWhatsapp(phone) !== phone) return null;
  const message = `Olá, ${name}! Seu cadastro no Aprova UNIVESP foi aprovado. Confirme seu e-mail, caso ainda não tenha confirmado, e entre com sua senha: ${base}/entrar`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
