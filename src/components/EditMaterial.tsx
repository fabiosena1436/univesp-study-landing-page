"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { MaterialDetail } from "@/lib/types";
import { Button, Input, TextArea } from "./ui";
import { toast } from "./AppShell";

export function EditMaterial({ material, onSaved, disabled }: { material: MaterialDetail; onSaved: (m: MaterialDetail) => void; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const updated = await api<MaterialDetail>(`/api/materials/${material.id}`, { method: "PATCH", body: JSON.stringify({ title, content, originalTitle: material.title, originalContent: material.content }) });
      onSaved(updated); setEditing(false); toast("Material atualizado. As questões publicadas continuam disponíveis para edição no banco.");
    } catch (e) { toast(e instanceof Error ? e.message : "Erro ao editar material.", "err"); }
    finally { setBusy(false); }
  }
  if (!editing) return <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { setTitle(material.title); setContent(material.content); setEditing(true); }}>Editar material</Button>;
  return <div className="mt-4 w-full space-y-3">
    <p className="text-sm text-muted">As mudanças valem para as próximas gerações. Questões já salvas são editadas separadamente no banco.</p>
    <label className="block text-sm">Título<Input aria-label="Título do material salvo" maxLength={90} value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></label>
    <label className="block text-sm">Conteúdo<TextArea aria-label="Conteúdo do material salvo" rows={12} maxLength={400000} value={content} disabled={busy} onChange={(e) => setContent(e.target.value)} /></label>
    <div className="flex gap-2"><Button disabled={busy || disabled || title.trim().length < 2 || content.trim().length < 400} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar material"}</Button><Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancelar</Button></div>
  </div>;
}
