"use client";
import { useState } from "react";
import { useApp, toast } from "@/components/AppShell";
import { api } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";
export default function PerfilPage() {
  const { user } = useApp(); const [name, setName] = useState(user.name); const [course, setCourse] = useState(user.course ?? ""); const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name, course, currentPassword, newPassword }) }); setCurrentPassword(""); setNewPassword(""); toast("Perfil atualizado."); } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível atualizar.", "err"); } finally { setBusy(false); } }
  return <div className="max-w-2xl space-y-6"><div><h1 className="font-display text-3xl font-semibold tracking-tight">Meu perfil</h1><p className="mt-2 text-ink-soft">Atualize seus dados e sua senha.</p></div><div className="card p-6 space-y-4"><Field label="Nome"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="E-mail institucional"><Input value={user.email} disabled /></Field><Field label="Curso"><Input value={course} onChange={(e) => setCourse(e.target.value)} /></Field><div className="border-t border-line pt-4 space-y-4"><h2 className="font-semibold">Alterar senha</h2><Field label="Senha atual"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field><Field label="Nova senha" hint="Deixe vazio para manter a atual."><Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field></div><Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar alterações"}</Button></div></div>;
}
