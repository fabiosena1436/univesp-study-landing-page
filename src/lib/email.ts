export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendAccountEmail(to, "Redefinição de senha — Aprova UNIVESP", resetUrl, "Criar nova senha", "O link expira em 30 minutos. Se você não pediu isso, ignore este e-mail.");
}

export async function sendAccountEmail(to: string, subject: string, url: string, label: string, description: string) {
  const purpose = subject.startsWith("Confirme") ? "verification" : "password_reset";
  const context = { purpose, requestId: randomUUID(), recipientDomain: to.split("@")[1], at: new Date().toISOString() };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    console.error(JSON.stringify({ event: "email.send.failed", ...context, reason: "missing_configuration" }));
    throw new Error("Envio de e-mail não configurado.");
  }
  try {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: `${label}: ${url}\n${description}`,
      html: `<p><a href="${url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}">${label}</a></p><p>${description}</p>`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => null) as { id?: string; name?: string } | null;
  if (!res.ok || !data?.id) {
    console.error(JSON.stringify({ event: "email.send.failed", ...context, status: res.status,
      reason: data?.name && /^[a-z_]{1,80}$/.test(data.name) ? data.name : "provider_rejected" }));
    throw new Error("Não foi possível enviar o e-mail.");
  }
  console.info(JSON.stringify({ event: "email.send.accepted", ...context, providerId: data.id }));
  return data.id;
  } catch (error) {
    if (error instanceof Error && error.message === "Não foi possível enviar o e-mail.") throw error;
    console.error(JSON.stringify({ event: "email.send.failed", ...context, reason: "network_or_timeout" }));
    throw new Error("Não foi possível enviar o e-mail.");
  }
}
import { randomUUID } from "crypto";

