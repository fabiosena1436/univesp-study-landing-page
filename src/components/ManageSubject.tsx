"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { toast, useApp } from "./AppShell";
import { Button, Input } from "./ui";
import type { Subject } from "@/lib/types";

export function ManageSubject({ subject }: { subject: Subject }) {
  const { user, refreshSubjects } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [busy, setBusy] = useState(false);
  async function change(remove = false) {
    if (busy) return;
    if (remove && !window.confirm(`Excluir a matéria “${subject.name}”, seus materiais e suas ${subject.questionCount} questões? Eles sairão do banco. O histórico das provas será preservado.`)) return;
    setBusy(true);
    try {
      await api(`/api/subjects/${subject.id}`, { method: remove ? "DELETE" : "PATCH", ...(remove ? {} : { body: JSON.stringify({ name, color }) }) });
      await refreshSubjects();
      setEditing(false);
      toast(remove ? "Matéria e conteúdo removidos do banco. Histórico preservado." : "Matéria atualizada.");
    } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível atualizar a matéria.", "err"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-3">
    {editing && <div className="space-y-2">
      <label className="block text-sm">Nome da matéria<Input aria-label={`Nome da matéria ${subject.name}`} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} /></label>
      <label className="flex items-center gap-3 text-sm">Cor<input type="color" aria-label={`Cor da matéria ${subject.name}`} value={color} onChange={(e) => setColor(e.target.value)} disabled={busy} /></label>
    </div>}
    <div className="flex flex-wrap gap-2">
      {editing ? <><Button size="sm" disabled={busy || name.trim().length < 2} onClick={() => void change()}>{busy ? "Salvando…" : "Salvar matéria"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button></> : <Button size="sm" variant="ghost" onClick={() => { setName(subject.name); setColor(subject.color); setEditing(true); }}>Editar matéria</Button>}
      {user.isAdmin && <Button size="sm" variant="danger" disabled={busy} onClick={() => void change(true)}>Excluir matéria</Button>}
    </div>
  </div>;
}
