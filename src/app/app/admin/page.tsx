"use client";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { Badge, Button, Input, Spinner } from "@/components/ui";
import { toast, useApp } from "@/components/AppShell";
type AdminUser = { id: string; name: string; email: string; isAdmin: boolean; isBlocked: boolean; createdAt: string; attempts: number; answered: number; correct: number };
type Ticket = { id: string; userName: string; userEmail: string; subject: string; status: string };
type Message = { id: string; ticketId: string; body: string; createdAt: string };
type Audit = { id: string; action: string; targetId: string; createdAt: string };
export default function AdminPage() {
  const { user } = useApp();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<Audit[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [userPage, setUserPage] = useState(0);
  const [ticketPage, setTicketPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user.isAdmin) return;
    let alive = true;
    Promise.all([
      api<AdminUser[]>(`/api/admin/users?limit=50&offset=${userPage * 50}`),
      api<{ tickets: Ticket[]; messages: Message[] }>(`/api/support?limit=50&offset=${ticketPage * 50}`),
      api<Audit[]>(`/api/admin/audit?limit=50&offset=${eventPage * 50}`),
    ]).then(([users, support, events]) => {
      if (!alive) return;
      setUsers(users); setTickets(support.tickets); setMessages(support.messages); setEvents(events); setError("");
    }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar a administração."); });
    return () => { alive = false; };
  }, [user.isAdmin, userPage, ticketPage, eventPage]);
  async function mutate(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível concluir.", "err"); }
    finally { setBusy(false); }
  }
  if (!user.isAdmin) return <p className="card p-6">Acesso restrito ao administrador.</p>;
  if (error) return <div role="alert" className="card p-6">{error}<Button onClick={() => window.location.reload()}>Tentar novamente</Button></div>;
  return <div className="space-y-6"><h1 className="font-display text-3xl font-semibold">Administração</h1>
    <section className="card p-5"><h2 className="font-semibold text-xl">Usuários cadastrados</h2>
      <Pagination page={userPage} next={users?.length === 50} setPage={setUserPage} />
      {!users ? <Spinner /> : users.map((item) => <div key={item.id} className="py-4 border-b border-line flex flex-wrap gap-3 items-center"><div className="flex-1 min-w-52"><p className="font-semibold">{item.name} {item.isAdmin && <Badge>Admin</Badge>} {item.isBlocked && <Badge tone="red">Bloqueado</Badge>}</p><p className="text-sm break-all">{item.email}</p><p className="text-xs text-muted">{item.attempts} provas · {item.answered} respostas · {item.correct} acertos</p></div>
        {!item.isAdmin && <><Button disabled={busy} variant="ghost" onClick={() => mutate(async () => { await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: item.id, blocked: !item.isBlocked }) }); setUsers((list) => list?.map((u) => u.id === item.id ? { ...u, isBlocked: !u.isBlocked } : u) ?? null); toast("Acesso atualizado."); })}>{item.isBlocked ? "Desbloquear" : "Bloquear"}</Button><Button disabled={busy} variant="danger" onClick={() => { if (window.confirm("Excluir permanentemente esta conta e seu histórico?")) void mutate(async () => { await api(`/api/admin/users?id=${item.id}`, { method: "DELETE" }); setUsers((list) => list?.filter((u) => u.id !== item.id) ?? null); toast("Conta excluída."); }); }}>Excluir</Button></>}
      </div>)}
    </section>
    <section className="card p-5 space-y-4"><h2 className="font-semibold text-xl">Atendimentos</h2><Pagination page={ticketPage} next={tickets.length === 50} setPage={setTicketPage} />
      {!tickets.length && <p>Nenhum atendimento nesta página.</p>}
      {tickets.map((ticket) => <div key={ticket.id} className="rounded-xl border border-line p-4 space-y-3"><p className="font-semibold">{ticket.subject} <Badge>{ticket.status}</Badge></p><p className="text-xs break-all">{ticket.userName} · {ticket.userEmail}</p>
        {messages.filter((m) => m.ticketId === ticket.id).map((m) => <p key={m.id} className="text-sm whitespace-pre-line">{m.body}</p>)}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void mutate(async () => { const message = reply[ticket.id]?.trim(); if (!message) return; await api("/api/support", { method: "PATCH", body: JSON.stringify({ ticketId: ticket.id, message }) }); setReply((r) => ({ ...r, [ticket.id]: "" })); setTickets((list) => list.map((t) => t.id === ticket.id ? { ...t, status: "answered" } : t)); setMessages((list) => [...list, { id: crypto.randomUUID(), ticketId: ticket.id, body: message, createdAt: new Date().toISOString() }]); toast("Resposta enviada."); }); }}>
          <Input aria-label={`Resposta para ${ticket.subject}`} required maxLength={5000} className="flex-1 min-w-44" value={reply[ticket.id] ?? ""} onChange={(e) => setReply((r) => ({ ...r, [ticket.id]: e.target.value }))} /><Button type="submit" disabled={busy}>Responder</Button>
        </form>
      </div>)}
    </section>
    <section className="card p-5 space-y-3"><h2 className="font-semibold text-xl">Auditoria</h2><Pagination page={eventPage} next={events.length === 50} setPage={setEventPage} /><p className="text-sm text-muted">Ações registradas no servidor; novas ações aparecem ao atualizar a página.</p>{events.map((event) => <p key={event.id} className="text-sm break-all">{formatDate(event.createdAt)} · {event.action} · {event.targetId}</p>)}</section>
  </div>;
}
function Pagination({ page, next, setPage }: { page: number; next: boolean; setPage: (page: number) => void }) { return <div className="my-4 flex gap-3 items-center"><Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="ghost" disabled={!next} onClick={() => setPage(page + 1)}>Próxima</Button></div>; }
