export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) throw new Error("RESEND_API_KEY e RESEND_FROM_EMAIL não configurados.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Redefinição de senha — Aprova UNIVESP",
      html: `<p>Recebemos um pedido para redefinir sua senha.</p><p><a href="${resetUrl}">Criar nova senha</a></p><p>O link expira em 30 minutos. Se você não pediu isso, ignore este e-mail.</p>`,
    }),
  });
  if (!res.ok) throw new Error("Não foi possível enviar o e-mail de recuperação.");
}
