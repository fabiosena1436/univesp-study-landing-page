"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Input, TextArea } from "@/components/ui";
import { toast } from "@/components/AppShell";
type Ticket = { id: string; subject: string; status: string };
type Message = { id: string; ticketId: string; body: string; createdAt: string };
export default function ContatoPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<{ tickets: Ticket[]; messages: Message[] }>(`/api/support?limit=50&offset=${page * 50}`).then((r) => { if (alive) { setTickets(r.tickets); setMessages(r.messages); setError(""); } }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar atendimentos."); });
    return () => { alive = false; };
  }, [page, revision]);
  async function send() {
    setSending(true);
    try { await api("/api/support", { method: "POST", body: JSON.stringify({ subject, message }) }); setSubject(""); setMessage(""); setPage(0); setRevision((r) => r + 1); toast("Mensagem enviada ao administrador."); }
    catch (e) { toast(e instanceof Error ? e.message : "Não foi possível enviar.", "err"); }
    finally { setSending(false); }
  }
  return <div className="max-w-2xl space-y-6"><h1 className="font-display text-3xl font-semibold">Falar com o administrador</h1><p>Envie sugestões, dúvidas ou relate um problema. Contato: <a className="underline" href="mailto:fabiosena1436@gmail.com">fabiosena1436@gmail.com</a>.</p>
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}><Field label="Assunto"><Input required minLength={3} maxLength={120} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field><Field label="Mensagem"><TextArea required minLength={3} maxLength={5000} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></Field><Button type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar mensagem"}</Button></form>
    <section className="card p-5 space-y-4"><h2 className="font-semibold">Seus atendimentos</h2>{error && <p role="alert">{error}<Button onClick={() => setRevision((r) => r + 1)}>Tentar novamente</Button></p>}<div className="flex gap-3 items-center"><Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button variant="ghost" disabled={tickets.length < 50} onClick={() => setPage((p) => p + 1)}>Próxima</Button></div>
      {!error && !tickets.length && <p>Nenhum atendimento nesta página.</p>}{tickets.map((t) => <div key={t.id} className="border-b border-line pb-3"><p className="font-semibold">{t.subject} <span className="text-xs text-muted">({t.status})</span></p>{messages.filter((m) => m.ticketId === t.id).map((m) => <p key={m.id} className="mt-2 text-sm whitespace-pre-line">{m.body}</p>)}</div>)}
    </section></div>;
}
