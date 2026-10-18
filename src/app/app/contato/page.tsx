"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Input, TextArea } from "@/components/ui";
import { toast, useApp } from "@/components/AppShell";
type Ticket = { id: string; subject: string; status: string };
type Message = { id: string; ticketId: string; senderId: string; body: string; createdAt: string };
export default function ContatoPage() {
  const { user } = useApp();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const revealConversation = () => {
      const id = window.location.hash.slice(1);
      if (id.startsWith("conversa-")) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    revealConversation();
    window.addEventListener("hashchange", revealConversation);
    return () => window.removeEventListener("hashchange", revealConversation);
  }, [tickets]);
  useEffect(() => {
    let alive = true;
    let pending = false;
    const controller = new AbortController();
    const load = () => {
      if (pending) return;
      pending = true;
      void api<{ tickets: Ticket[]; messages: Message[] }>(`/api/support?limit=50&offset=${page * 50}`, { signal: controller.signal }).then((r) => { if (alive) { setTickets(r.tickets); setMessages(r.messages); setError(""); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar atendimentos."); }).finally(() => { pending = false; });
    };
    load();
    window.addEventListener("repete:inbox-updated", load);
    return () => { alive = false; controller.abort(); window.removeEventListener("repete:inbox-updated", load); };
  }, [page, revision]);
  async function send() {
    setSending(true);
    try { await api("/api/support", { method: "POST", body: JSON.stringify({ subject, message }) }); setSubject(""); setMessage(""); setPage(0); setRevision((r) => r + 1); toast("Mensagem enviada ao administrador."); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível enviar.", "err"); }
    finally { setSending(false); }
  }
  return <div className="max-w-2xl space-y-6"><h1 className="font-display text-3xl font-semibold">Falar com o administrador</h1><p>Envie sugestões, dúvidas ou relate um problema. Contato: <a className="underline" href="mailto:fabiosena1436@gmail.com">fabiosena1436@gmail.com</a>.</p>
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}><Field label="Assunto"><Input required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field><Field label="Mensagem"><TextArea required minLength={3} maxLength={5000} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></Field><Button type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar mensagem"}</Button></form>
    <section id="atendimentos" className="card p-5 space-y-4 scroll-mt-40"><h2 className="font-semibold">Seus atendimentos</h2>{error && <p role="alert">{error}<Button onClick={() => setRevision((r) => r + 1)}>Tentar novamente</Button></p>}<div className="flex gap-3 items-center"><Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="ghost" disabled={tickets.length < 50} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div>
      {!error && !tickets.length && <p>Nenhum atendimento nesta página.</p>}{tickets.map((t) => <div key={t.id} id={`conversa-${t.id}`} className="border-b border-line pb-3 space-y-3 scroll-mt-40"><p className="font-semibold">{t.subject} <span className="text-xs text-muted">({t.status === "answered" ? "Respondido" : "Em aberto"})</span></p>{messages.filter((m) => m.ticketId === t.id).map((m) => <div key={m.id} className="rounded-xl bg-surface p-3"><p className="text-xs font-semibold">{m.senderId === user.id ? "Você" : "Administração"}</p><p className="mt-1 text-sm whitespace-pre-wrap break-words">{m.body}</p></div>)}
        <Button variant="ghost" disabled={sending} onClick={async () => { try { await api("/api/support", { method: "PATCH", body: JSON.stringify({ ticketId: t.id, read: true }) }); toast("Conversa marcada como lida."); } catch (e) { toast(e instanceof Error ? e.message : "Falha ao marcar leitura.", "err"); } }}>Marcar conversa como lida</Button>
        <form className="space-y-2" onSubmit={async e => { e.preventDefault(); if (sending) return; setSending(true); try { await api("/api/support", { method: "PATCH", body: JSON.stringify({ ticketId: t.id, message: replies[t.id] }) }); setReplies(values => ({ ...values, [t.id]: "" })); setRevision(value => value + 1); } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível responder.", "err"); } finally { setSending(false); } }}><TextArea aria-label={`Responder conversa: ${t.subject}`} required minLength={3} maxLength={5000} rows={2} value={replies[t.id] ?? ""} onChange={e => setReplies(values => ({ ...values, [t.id]: e.target.value }))} /><Button disabled={sending}>Responder conversa</Button></form>
      </div>)}
    </section></div>;
}
