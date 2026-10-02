export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendAccountEmail(to, "Redefinição de senha — Aprova UNIVESP", resetUrl, "Criar nova senha", "O link expira em 30 minutos. Se você não pediu isso, ignore este e-mail.");
}

export async function sendAccountEmail(to: string, subject: string, url: string, label: string, description: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error("RESEND_API_KEY e RESEND_FROM_EMAIL não configurados.");
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
  if (!res.ok) throw new Error("Não foi possível enviar o e-mail de recuperação.");
}
