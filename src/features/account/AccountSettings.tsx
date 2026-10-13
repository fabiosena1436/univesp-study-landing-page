"use client";
import { MfaSettings } from "./MfaSettings";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/AppShell";
import { api, clearQuizDrafts } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
import type { User } from "@/lib/types";
export function AccountSettings({ initialUser, onUpdated }: { initialUser: User; onUpdated?: (user: User) => void }) {
  const [user, setUser] = useState(initialUser);
  const [notice, setNotice] = useState("");
  function updateUser(next: User) { setUser(next); onUpdated?.(next); }
  function notify(message: string, tone: "ok" | "err" = "ok") { setNotice(message); toast(message, tone); }
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [course, setCourse] = useState(user.course ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { const result = await api<{ user: User }>("/api/profile", { method: "PATCH", body: JSON.stringify({ name, course, currentPassword, newPassword }) }); updateUser({ ...result.user, isAdmin: user.isAdmin, isAssistant: user.isAssistant }); setCurrentPassword(""); setNewPassword(""); notify("Perfil atualizado. Ao trocar a senha, as outras sessões são encerradas."); }
    catch (e) { notify(e instanceof Error ? e.message : "Não foi possível atualizar.", "err"); }
    finally { setBusy(false); }
  }
  async function exportData() {
    setBusy(true);
    try {
      const data = await api("/api/account");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "aprova-univesp-dados.json";
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Exportação preparada.");
    } catch (e) { notify(e instanceof Error ? e.message : "Não foi possível exportar.", "err"); }
    finally { setBusy(false); }
  }
  async function removeAccount() {
    setBusy(true);
    try { await api("/api/account", { method: "DELETE", body: JSON.stringify({ password: deletePassword, confirmation }) }); clearQuizDrafts(); router.replace("/"); router.refresh(); }
    catch (e) { notify(e instanceof Error ? e.message : "Não foi possível excluir.", "err"); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl space-y-6"><div><h1 className="font-display text-3xl font-semibold">Minha conta</h1><p className="mt-2 text-ink-soft">Atualize seus dados e sua senha.</p></div>
    {notice && <p role="status" className="rounded-xl bg-pen-soft p-3 text-sm">{notice}</p>}
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="card p-6 space-y-4">
      <Field label="Nome"><Input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="E-mail da conta"><Input value={user.email} disabled /></Field><Field label="Curso"><Input required minLength={2} maxLength={120} value={course} onChange={(e) => setCourse(e.target.value)} /></Field>
      <div className="border-t border-line pt-4 space-y-4"><h2 className="font-semibold">Alterar senha</h2><Field label="Senha atual"><Input autoComplete="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field><Field label="Nova senha" hint="Mínimo de 15 caracteres e máximo de 72 bytes. Deixe vazio para manter a atual."><Input autoComplete="new-password" type="password" minLength={15} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field></div>
      <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</Button>
    </form>
    <MfaSettings />
    <section className="card p-6 space-y-4"><h2 className="font-semibold text-xl">Seus dados</h2><p>Baixe seu perfil, histórico, respostas, revisões e atendimentos.</p><Button variant="ghost" disabled={busy} onClick={exportData}>Exportar meus dados</Button><p className="text-sm"><Link className="underline" href="/privacidade">Privacidade</Link> · <Link className="underline" href="/termos">Termos</Link></p></section>
    <form onSubmit={(e) => { e.preventDefault(); void removeAccount(); }} className="card p-6 space-y-4 border-red/30"><h2 className="font-semibold text-xl text-red">Excluir minha conta</h2><p>Seu perfil, histórico, progresso e atendimentos serão excluídos. Materiais publicados no catálogo permanecem sem vínculo com sua conta. Esta ação não pode ser desfeita.</p><Field label="Sua senha"><Input type="password" autoComplete="current-password" required value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} /></Field><Field label="Digite EXCLUIR para confirmar"><Input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></Field><Button variant="danger" type="submit" disabled={busy || confirmation !== "EXCLUIR"}>Excluir conta definitivamente</Button></form>
  </div>;
}
