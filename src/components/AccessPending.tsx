"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";
import { Button } from "./ui";
import { api, clearQuizDrafts } from "@/lib/api";
import type { User } from "@/lib/types";

export default function AccessPending({ user, emailFailed }: { user: User; emailFailed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(emailFailed ? "Sua conta foi criada, mas o envio do e-mail falhou. Solicite um novo link ou contate o administrador." : "");
  async function resend() {
    setBusy(true);
    try { const result = await api<{ message: string }>("/api/auth/resend-verification", { method: "POST" }); setMessage(result.message); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível enviar o e-mail."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await api("/api/auth/logout", { method: "POST" }); clearQuizDrafts(); router.replace("/entrar"); router.refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível sair."); setBusy(false); }
  }
  return <AuthShell>
    <h1 className="font-display text-3xl font-semibold">{user.accessStatus === "rejected" ? "Cadastro não autorizado" : "Acompanhe seu acesso"}</h1>
    <p className="mt-3 text-ink-soft">Olá, {user.name}. Sua conta foi criada. O conteúdo fica disponível após a confirmação do e-mail e a autorização do administrador.</p>
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-line p-4"><p className="font-semibold">Confirmação do e-mail</p><p className="mt-1 text-sm break-all">{user.email}</p><p className="mt-2">{user.emailVerifiedAt ? "E-mail confirmado." : "Abra o link enviado para sua caixa de entrada. Confira também o spam. O link expira em 24 horas."}</p>{!user.emailVerifiedAt && <Button className="mt-3" disabled={busy} onClick={resend}>Reenviar confirmação</Button>}</div>
      <div className="rounded-xl border border-line p-4"><p className="font-semibold">Autorização do administrador</p><p className="mt-2">{user.accessStatus === "approved" ? "Acesso autorizado. Falta confirmar seu e-mail." : user.accessStatus === "rejected" ? "Seu cadastro não foi autorizado. Entre em contato com o responsável se precisar de esclarecimentos." : "Seu cadastro está aguardando aprovação. O administrador poderá avisar pelo WhatsApp informado."}</p></div>
      {message && <p role="status" className="text-sm rounded-xl bg-pen-soft p-3">{message}</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => router.refresh()}>Consultar acesso</Button><Button disabled={busy} variant="ghost" onClick={logout}>Sair</Button></div>
      <p className="text-sm text-muted">Contato: <a className="underline" href="mailto:fabiosena1436@gmail.com">fabiosena1436@gmail.com</a></p>
    </div>
  </AuthShell>;
}
