"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api, formatDate } from "@/lib/api";
import type { InboxSummary } from "./CommunityInbox";

type Ticket = { id: string; subject: string; updatedAt: string; userReadAt: string | null };
type Message = { ticketId: string; senderId: string; body: string };
type Notice = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export function UserNotifications({ summary, userId }: { summary: InboxSummary; userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ tickets: Ticket[]; messages: Message[]; notices: Notice[] } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true, pending = false;
    const controller = new AbortController();
    const load = async () => {
      if (pending) return;
      pending = true; setLoading(true); setError("");
      try {
        const [support, notices] = await Promise.all([
          api<{ tickets: Ticket[]; messages: Message[] }>("/api/support?limit=10", { signal: controller.signal }),
          api<Notice[]>("/api/announcements", { signal: controller.signal }),
        ]);
        if (alive) setData({ ...support, notices });
      } catch { if (alive) setError("Não foi possível carregar as notificações."); }
      finally { pending = false; if (alive) setLoading(false); }
    };
    void load();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    window.addEventListener("repete:notifications", load);
    window.addEventListener("repete:inbox-updated", load);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      alive = false; controller.abort();
      window.removeEventListener("repete:notifications", load);
      window.removeEventListener("repete:inbox-updated", load);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, revision]);
  const count = summary.unread + summary.fresh;
  return <div ref={root} className="relative">
    <button ref={button} type="button" aria-label={`Notificações: ${summary.unread} conversa(s) não lida(s) e ${summary.fresh} recado(s) novo(s)`} aria-expanded={open} aria-controls="user-notifications" onClick={() => setOpen(value => !value)} className="relative rounded-lg p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
      <Bell size={21} aria-hidden="true" />
      {count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red px-1 text-center text-xs font-bold text-white">{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <section id="user-notifications" aria-label="Suas notificações" aria-busy={loading} className="absolute right-0 top-12 w-96 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto rounded-xl border border-line bg-paper p-4 text-ink shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Notificações</h2><button type="button" className="text-sm underline" onClick={() => setOpen(false)}>Fechar</button></div>
      {loading && <p role="status" className="text-sm text-muted">Carregando notificações…</p>}
      {error && <p role="alert" className="text-sm text-red">{error} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></p>}
      {!error && data && <>
        <div className="space-y-2"><h3 className="text-sm font-semibold">Mensagens da administração</h3>
          {!data.tickets.length && <p className="text-sm text-muted">Nenhuma mensagem recebida.</p>}
          {data.tickets.map(ticket => {
            const last = data.messages.filter(message => message.ticketId === ticket.id).at(-1);
            const unread = !ticket.userReadAt || Date.parse(ticket.userReadAt) < Date.parse(ticket.updatedAt);
            return <Link key={ticket.id} href={`/app/contato#conversa-${ticket.id}`} onClick={() => setOpen(false)} className="block rounded-lg border border-line p-3 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-pen">
              <span className="block font-semibold break-words">{ticket.subject}{unread && <span className="ml-2 text-xs text-pen">Nova mensagem</span>}</span>
              {last && <span className="mt-1 block break-words text-muted">{last.senderId === userId ? "Você: " : "Administração: "}{last.body.slice(0, 180)}{last.body.length > 180 ? "…" : ""}</span>}
              <span className="mt-2 block text-xs text-muted">{formatDate(ticket.updatedAt)}</span>
              <span className="mt-1 block font-semibold text-pen">Abrir conversa</span>
            </Link>;
          })}
        </div>
        <div className="space-y-2"><h3 className="text-sm font-semibold">Recados da administração</h3>
          {!data.notices.length && <p className="text-sm text-muted">Nenhum recado para você.</p>}
          {data.notices.slice(0, 10).map(notice => <Link key={notice.id} href={`#recado-${notice.id}`} onClick={() => { window.dispatchEvent(new Event("repete:open-notices")); setOpen(false); }} className="block rounded-lg border border-line p-3 text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-pen">
            <span className="block font-semibold break-words">{notice.title}{!notice.readAt && <span className="ml-2 text-xs text-pen">Novo recado</span>}</span>
            <span className="mt-1 block break-words text-muted">{notice.body.slice(0, 180)}{notice.body.length > 180 ? "…" : ""}</span>
            <span className="mt-2 block text-xs text-muted">{formatDate(notice.createdAt)}</span>
            <span className="mt-1 block font-semibold text-pen">Ler recado</span>
          </Link>)}
        </div>
      </>}
      <Link href="/app/contato#atendimentos" onClick={() => setOpen(false)} className="block text-sm font-semibold text-pen underline">Ver todas as conversas</Link>
    </section>}
  </div>;
}
