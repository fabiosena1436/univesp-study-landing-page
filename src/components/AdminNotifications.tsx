"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

type Summary = { registrations: number; pending: number; unread: number; latestRegistrationAt: string | null; latestMessageAt: string | null; checkedAt: string };
export function AdminNotifications({ userId }: { userId: string }) {
  const [data, setData] = useState<Summary | null>(null), [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const previous = useRef<Summary | null>(null), since = useRef<string | null>(null);
  const active = useRef(true), pending = useRef(false), root = useRef<HTMLDivElement>(null);
  const storageKey = `aprova:admin-notifications:${userId}`;
  const load = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    return api<Summary>(`/api/admin/notifications${since.current ? `?since=${encodeURIComponent(since.current)}` : ""}`).then(value => {
      if (!active.current) return;
      const old = previous.current;
      const newRegistration = old && value.latestRegistrationAt && Date.parse(value.latestRegistrationAt) > Date.parse(old.latestRegistrationAt ?? "1970-01-01");
      const newMessage = old && value.unread > 0 && value.latestMessageAt && Date.parse(value.latestMessageAt) > Date.parse(old.latestMessageAt ?? "1970-01-01");
      if (newRegistration || newMessage) window.dispatchEvent(new CustomEvent("repete:toast", { detail: { msg: [newRegistration && "Novo cadastro na plataforma.", newMessage && "Você recebeu uma nova mensagem."].filter(Boolean).join(" ") } }));
      previous.current = value;
      setData(value); setError(false);
      // Establish a baseline on the first visit when there is no registration pending.
      if (!since.current && !value.registrations) {
        since.current = value.latestRegistrationAt ?? value.checkedAt;
        try { localStorage.setItem(storageKey, since.current); } catch { /* Keep the in-memory cursor. */ }
      }
    }).catch(() => { if (active.current) setError(true); }).finally(() => { pending.current = false; });
  }, [storageKey]);
  useEffect(() => {
    active.current = true;
    try { const saved = localStorage.getItem(storageKey); since.current = saved && Number.isFinite(Date.parse(saved)) ? saved : null; } catch { since.current = null; }
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("repete:notifications", refresh);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { active.current = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("repete:notifications", refresh); document.removeEventListener("visibilitychange", refresh); document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [load, storageKey]);
  const count = (data?.registrations ?? 0) + (data?.unread ?? 0);
  return <div className="relative" ref={root}>
    <button type="button" aria-label={`Notificações${count ? `: ${count} pendentes` : ""}${error ? ": falha ao atualizar" : ""}`} aria-expanded={open} aria-controls="admin-notifications" onClick={() => setOpen(value => !value)} className="relative rounded-lg p-2 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
      <Bell size={21} aria-hidden="true" />{(count > 0 || error) && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red px-1 text-center text-xs font-bold text-white">{error ? "!" : count > 99 ? "99+" : count}</span>}
    </button>
    <span className="sr-only" role="status">{data && `${data.registrations} novos cadastros e ${data.unread} conversas não lidas.`}</span>
    {open && <section id="admin-notifications" aria-label="Notificações da administração" className="absolute right-0 top-12 w-72 max-w-[85vw] rounded-xl border border-line bg-paper p-4 text-ink shadow-xl space-y-3">
      <h2 className="font-semibold">Notificações</h2>
      {error ? <p role="alert" className="text-sm text-red">Não foi possível atualizar. <button className="underline" onClick={() => void load()}>Tentar novamente</button></p> : !data ? <p className="text-sm">Carregando…</p> : <>
        <Link className="block rounded-lg border border-line p-3 text-sm hover:bg-surface" href={data.pending ? "/app/admin#cadastros" : "/app/admin#usuarios"} onClick={() => {
          if (data.latestRegistrationAt) { since.current = data.latestRegistrationAt; try { localStorage.setItem(storageKey, since.current); } catch { /* Keep the in-memory cursor. */ } }
          setData(value => value ? { ...value, registrations: 0 } : value); setOpen(false);
          window.dispatchEvent(new Event("repete:open-registrations"));
        }}><strong>{data.registrations} novo(s) cadastro(s)</strong><span className="block text-muted">{data.pending} aguardando aprovação · Ver cadastros</span></Link>
        <Link className="block rounded-lg border border-line p-3 text-sm hover:bg-surface" href="/app/admin#atendimentos" onClick={() => { setOpen(false); window.dispatchEvent(new Event("repete:open-messages")); }}><strong>{data.unread} conversa(s) não lida(s)</strong><span className="block text-muted">Ver mensagens e responder</span></Link>
        {!count && <p className="text-sm text-muted">Nenhuma novidade.</p>}
      </>}
      <p className="text-xs text-muted">Atualiza a cada 30 segundos enquanto o site está aberto e visível. Cadastros vistos são lembrados neste navegador.</p>
    </section>}
  </div>;
}
