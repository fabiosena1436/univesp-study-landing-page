"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

export default function EmailVerificationPending({ email, message, sent = true }: {
  email: string;
  message: string;
  sent?: boolean;
}) {
  const [feedback, setFeedback] = useState(message);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(sent ? 180 : 0);
  const domain = email.split("@")[1];
  const webmail = domain === "aluno.univesp.br" ? "https://outlook.office.com/mail/" :
    domain === "gmail.com" ? "https://mail.google.com/" : null;

  useEffect(() => {
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  async function resend() {
    if (busy || remaining > 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("/api/auth/resend-verification", {
        method: "POST", body: JSON.stringify({ email }),
      });
      setFeedback(result.message);
      setRemaining(180);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível solicitar outro link.");
      setRemaining(60);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <p className="text-sm text-muted">Endereço da conta: <strong className="text-ink break-all">{email}</strong></p>
    <p role="status" className="rounded-xl border border-line bg-surface p-4 text-sm">{feedback}</p>
    <p className="text-sm text-muted">A mensagem pode levar alguns minutos para aparecer. Nos nossos testes com o e-mail da UNIVESP, a espera foi de 3 a 5 minutos. Esse tempo pode variar.</p>
    <ol className="list-decimal space-y-2 pl-5 text-sm">
      <li>Abra seu e-mail e atualize a Caixa de Entrada.</li>
      <li>Procure por <strong>Confirme seu e-mail — Aprova UNIVESP</strong>. Confira também Outros e Lixo Eletrônico.</li>
      <li>Abra o link recebido e confirme seu endereço no site. Depois, entre com sua senha.</li>
    </ol>
    {webmail && <a href={webmail} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-pen px-5 py-3 font-semibold text-white">Abrir meu e-mail <span className="sr-only">(nova aba)</span></a>}
    <div className="space-y-2 border-t border-line pt-4">
      <p className="text-sm text-muted">Não chegou? Aguarde antes de pedir outro link. Sua conta já existe; não é necessário refazer o cadastro.</p>
      <Button type="button" variant="ghost" disabled={busy || remaining > 0} onClick={() => void resend()}>
        {busy ? "Solicitando…" : remaining > 0 ? `Reenviar em ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` : "Reenviar link de confirmação"}
      </Button>
      {error && <p role="alert" className="text-sm text-red">{error}</p>}
      <p className="text-xs text-muted">Até 3 solicitações de reenvio por hora. Se continuar sem receber, contate <a className="underline" href="mailto:fabiosena1436@gmail.com">fabiosena1436@gmail.com</a>.</p>
    </div>
    <Link className="block font-semibold text-pen underline" href="/entrar">Já confirmei meu e-mail — entrar</Link>
  </div>;
}
