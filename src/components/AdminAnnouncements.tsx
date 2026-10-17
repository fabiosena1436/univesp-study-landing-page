"use client";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { AdminSection } from "./AdminSection";
import { Button, Field, Input, Select, TextArea } from "./ui";
type Notice = { id: string; title: string; body: string; active: boolean; recipientName: string | null; createdAt: string };
export function AdminAnnouncements({ users }: { users: { id: string; name: string; email: string }[] }) {
  const [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [recipient, setRecipient] = useState<{ id: string; name: string; email: string } | null>(null);
  const recipientId = recipient?.id ?? "";
  const [items, setItems] = useState<Notice[]>([]), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { const controller = new AbortController(); api<Notice[]>("/api/announcements?manage=1", { signal: controller.signal }).then(setItems).catch(() => { if (!controller.signal.aborted) setMessage("Não foi possível carregar os recados."); }); return () => controller.abort(); }, [revision]);
  return <AdminSection title="Recados da administração"><p className="text-sm text-muted">Publique para toda a comunidade ou para um usuário. Os recados aparecem dentro da plataforma.</p>
    <form className="space-y-3" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setMessage(""); try { await api("/api/announcements", { method: "POST", body: JSON.stringify({ title, body, recipientId: recipientId || null }) }); setTitle(""); setBody(""); setRevision(x => x + 1); setMessage("Recado publicado."); } catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível publicar."); } finally { setBusy(false); } }}>
      <Field label="Destinatário do recado"><Select value={recipientId} onChange={e => setRecipient(users.find(u => u.id === e.target.value) ?? null)}><option value="">Todos os usuários</option>{recipient && !users.some(u => u.id === recipient.id) && <option value={recipient.id}>{recipient.name} · {recipient.email}</option>}{users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</Select></Field>
      <p className="text-xs text-muted">A lista individual acompanha a página de usuários carregada abaixo.</p>
      <Field label="Título do recado"><Input required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Recado"><TextArea required minLength={3} maxLength={5000} rows={3} value={body} onChange={e => setBody(e.target.value)} /></Field><Button disabled={busy}>Publicar recado</Button>
    </form>{message && <p role="status" className="text-sm">{message}</p>}
    <details><summary className="cursor-pointer font-semibold">Últimos recados publicados ({items.length}, até 50)</summary><div className="mt-3 space-y-3">{items.map(n => <article key={n.id} className="rounded-xl border border-line p-3"><p className="font-semibold">{n.title} · {n.active ? "Ativo" : "Arquivado"}</p><p className="text-xs text-muted">{n.recipientName ?? "Todos os usuários"} · {formatDate(n.createdAt)}</p><p className="my-2 whitespace-pre-wrap text-sm">{n.body}</p><Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await api("/api/announcements", { method: "PATCH", body: JSON.stringify({ id: n.id, active: !n.active }) }); setRevision(x => x + 1); } catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao atualizar."); } finally { setBusy(false); } }}>{n.active ? "Arquivar" : "Reativar"}</Button></article>)}</div></details>
  </AdminSection>;
}
