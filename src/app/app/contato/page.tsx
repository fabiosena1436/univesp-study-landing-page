"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input, TextArea } from "@/components/ui";
import { toast } from "@/components/AppShell";

export default function ContatoPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<{ id: string; subject: string; status: string; }[]>([]);
  const [messages, setMessages] = useState<{ ticketId: string; body: string; createdAt: string; }[]>([]);
  useEffect(() => {
    api<{ tickets: typeof tickets; messages: typeof messages }>("/api/support")
      .then((r) => { setTickets(r.tickets); setMessages(r.messages); }).catch(() => {});
  }, []);
  async function send() {
    if (!subject.trim() || !message.trim()) {
      toast("Preencha o assunto e a mensagem.", "err");
      return;
    }
    setSending(true);
    try {
      await api("/api/support", { method: "POST", body: JSON.stringify({ subject, message }) });
      setSubject("");
      setMessage("");
      const r = await api<{ tickets: typeof tickets; messages: typeof messages }>("/api/support");
      setTickets(r.tickets); setMessages(r.messages);
      toast("Mensagem enviada ao administrador.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível enviar.", "err");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Falar com o administrador</h1>
        <p className="mt-2 text-ink-soft">Envie sugestões, dúvidas ou relate um problema.</p>
      </div>
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 text-pen"><MessageSquare size={20} /><span className="font-semibold">Novo atendimento</span></div>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" />
        <TextArea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva sua mensagem..." />
        <Button onClick={send} disabled={sending}>{sending ? "Enviando…" : <><Send size={16} /> Enviar mensagem</>}</Button>
      </div>
      {tickets.length > 0 && <div className="card p-5 space-y-4"><h2 className="font-semibold">Seus atendimentos</h2>{tickets.map((t) => <div key={t.id} className="border-b border-line pb-3"><p className="font-semibold">{t.subject} <span className="text-xs text-muted">({t.status})</span></p>{messages.filter((m) => m.ticketId === t.id).map((m) => <p key={`${m.ticketId}-${m.createdAt}`} className="mt-2 text-sm text-ink-soft">{m.body}</p>)}</div>)}</div>}
    </div>
  );
}
