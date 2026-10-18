"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, formatDate } from "@/lib/api";
import { Button } from "./ui";
type Notice = { id: string; title: string; body: string; createdAt: string; readAt: string | null };
export type InboxSummary = { unread: number; fresh: number };
type SupportSummary = { unread: number; latestMessageAt: string | null };
export function CommunityInbox({ admin, onSummary }: { admin: boolean; onSummary: (summary: InboxSummary) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]), [unread, setUnread] = useState(0), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const previous = useRef<{ support: SupportSummary; noticeIds: Set<string> } | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === "#recados" && details.current) details.current.open = true;
  }, [notices.length]);
  useEffect(() => {
    let alive = true, pending = false;
    const controller = new AbortController();
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const [notes, support] = await Promise.all([api<Notice[]>("/api/announcements", { signal: controller.signal }), api<SupportSummary>("/api/support?summary=1", { signal: controller.signal })]);
        if (!alive) return;
        const old = previous.current;
        const fresh = notes.filter(n => !n.readAt);
        const newMessage = support.unread > 0 && (!old || support.unread > old.support.unread || (support.latestMessageAt !== old.support.latestMessageAt && !!support.latestMessageAt && (!old.support.latestMessageAt || Date.parse(support.latestMessageAt) > Date.parse(old.support.latestMessageAt))));
        const newNotice = fresh.some(n => !old?.noticeIds.has(n.id));
        if (!admin && (newMessage || newNotice)) window.dispatchEvent(new CustomEvent("repete:toast", { detail: { msg: [newMessage && "Você tem uma nova mensagem da administração. Abra o sino para ler.", newNotice && "Você tem um novo recado da administração."].filter(Boolean).join(" ") } }));
        if (old && (support.unread !== old.support.unread || support.latestMessageAt !== old.support.latestMessageAt)) window.dispatchEvent(new Event("repete:inbox-updated"));
        previous.current = { support, noticeIds: new Set(notes.map(n => n.id)) };
        setNotices(notes); setUnread(support.unread); setError("");
        onSummary({ unread: support.unread, fresh: fresh.length });
      } catch { if (alive) setError("Não foi possível atualizar recados e mensagens."); }
      finally { pending = false; }
    };
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const openNotices = () => { if (details.current) details.current.open = true; };
    const openHash = () => { if (window.location.hash === "#recados") openNotices(); };
    openHash();
    window.addEventListener("focus", refresh);
    window.addEventListener("repete:notifications", refresh);
    window.addEventListener("repete:open-notices", openNotices);
    window.addEventListener("hashchange", openHash);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { alive = false; controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("repete:notifications", refresh); window.removeEventListener("repete:open-notices", openNotices); window.removeEventListener("hashchange", openHash); document.removeEventListener("visibilitychange", refresh); };
  }, [admin, onSummary, revision]);
  const fresh = notices.filter(n => !n.readAt).length;
  return <section id="recados" aria-label="Recados e mensagens" className="mb-6 card p-4 space-y-3 scroll-mt-40">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Recados e mensagens</h2><Link className="text-sm font-semibold text-pen underline" href={admin ? "/app/admin" : "/app/contato"}>{unread ? `${unread} conversa(s) não lida(s)` : "Abrir mensagens"}</Link></div>
    <p role="status" className={unread || fresh ? "text-sm font-semibold text-pen" : "sr-only"}>{unread} conversa(s) não lida(s) · {fresh} recado(s) novo(s)</p>
    {error && <p className="text-xs text-red">{error} <button className="underline" onClick={() => setRevision(value => value + 1)}>Atualizar</button></p>}
    {notices.length ? <details ref={details} className="group"><summary className="cursor-pointer text-sm text-pen">Recados da administração{fresh ? ` · ${fresh} novo(s)` : ""}</summary><div className="mt-3 space-y-3">{notices.map(n => <article key={n.id} className="rounded-xl border border-line p-3 space-y-2"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{n.title}{!n.readAt && <span className="ml-2 text-xs text-pen">Novo</span>}</h3><span className="text-xs text-muted">{formatDate(n.createdAt)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>{!n.readAt && <Button variant="ghost" onClick={async () => { try { await api("/api/announcements", { method: "PATCH", body: JSON.stringify({ id: n.id, read: true }) }); setNotices(list => list.map(item => item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item)); } catch { setError("Não foi possível marcar o recado como lido."); } }}>Marcar como lido</Button>}</article>)}</div></details> : <p className="text-xs text-muted">Nenhum recado publicado para você.</p>}
  </section>;
}
