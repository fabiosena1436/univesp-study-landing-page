"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, formatDate } from "@/lib/api";
import { Button } from "./ui";
type Notice = { id: string; title: string; body: string; createdAt: string; readAt: string | null };
export function CommunityInbox({ admin }: { admin: boolean }) {
  const [notices, setNotices] = useState<Notice[]>([]), [unread, setUnread] = useState(0), [error, setError] = useState("");
  const load = useCallback(() => {
    return Promise.all([api<Notice[]>("/api/announcements"), api<{ unread: number }>("/api/support?summary=1")]).then(([notes, support]) => {
      setNotices(notes);
      setUnread(support.unread);
      setError("");
    }).catch(() => setError("Não foi possível atualizar recados e mensagens."));
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  const fresh = notices.filter(n => !n.readAt).length;
  return <section aria-label="Recados e mensagens" className="mb-6 card p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Recados e mensagens</h2><Link className="text-sm font-semibold text-pen underline" href={admin ? "/app/admin" : "/app/contato"}>{unread ? `${unread} conversa(s) não lida(s)` : "Abrir mensagens"}</Link></div>
    {error && <p className="text-xs text-red">{error} <button className="underline" onClick={() => void load()}>Atualizar</button></p>}
    {notices.length ? <details className="group"><summary className="cursor-pointer text-sm text-pen">Recados da administração{fresh ? ` · ${fresh} novo(s)` : ""}</summary><div className="mt-3 space-y-3">{notices.map(n => <article key={n.id} className="rounded-xl border border-line p-3 space-y-2"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{n.title}{!n.readAt && <span className="ml-2 text-xs text-pen">Novo</span>}</h3><span className="text-xs text-muted">{formatDate(n.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>{!n.readAt && <Button variant="ghost" onClick={async () => { try { await api("/api/announcements", { method: "PATCH", body: JSON.stringify({ id: n.id, read: true }) }); setNotices(list => list.map(item => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)); } catch { setError("Não foi possível marcar o recado como lido."); } }}>Marcar como lido</Button>}</article>)}</div></details> : <p className="text-xs text-muted">Nenhum recado publicado para você.</p>}
  </section>;
}
