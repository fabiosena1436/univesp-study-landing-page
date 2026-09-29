"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { api, formatDate } from "@/lib/api";
import { Badge, Button, Spinner } from "@/components/ui";
import { toast, useApp } from "@/components/AppShell";

type AdminUser = {
  id: string; name: string; email: string; isAdmin: boolean; isBlocked: boolean;
  createdAt: string; lastLoginAt: string | null; attempts: number; answered: number; correct: number;
};
type Ticket = { id: string; userName: string; userEmail: string; subject: string; status: string; };

export default function AdminPage() {
  const { user } = useApp();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  useEffect(() => {
    api<AdminUser[]>("/api/admin/users").then(setUsers).catch((e) => toast(e.message, "err"));
    api<{ tickets: Ticket[] }>("/api/support").then((r) => setTickets(r.tickets)).catch(() => {});
  }, []);
  if (!user.isAdmin) return <div className="card p-6">Acesso restrito ao administrador.</div>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Administração</h1>
        <p className="mt-2 text-ink-soft">Acompanhe usuários e controle o acesso à plataforma.</p>
      </div>
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-pen" size={20} />
          <h2 className="font-semibold">Usuários cadastrados</h2>
          <Badge tone="neutral">{users?.length ?? "…"}</Badge>
        </div>
        {users === null ? <Spinner size={22} /> : (
          <div className="divide-y divide-line">
            {users.map((item) => (
              <div key={item.id} className="py-4 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-56">
                  <p className="font-semibold">{item.name} {item.isAdmin && <Badge tone="pen">admin</Badge>}</p>
                  <p className="text-xs text-muted">{item.email} · cadastro {formatDate(item.createdAt)}</p>
                  <p className="text-xs text-muted mt-1">{item.attempts} provas · {item.answered} respostas · {item.correct} acertos</p>
                </div>
                {item.isBlocked && <Badge tone="red">bloqueado</Badge>}
                {!item.isAdmin && (
                  <>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await api("/api/admin/users", { method: "PATCH", body: JSON.stringify({ id: item.id, blocked: !item.isBlocked }) });
                      setUsers((list) => list?.map((u) => u.id === item.id ? { ...u, isBlocked: !u.isBlocked } : u) ?? null);
                      toast(item.isBlocked ? "Usuário desbloqueado." : "Usuário bloqueado.");
                    }}>
                      {item.isBlocked ? <><UserRoundCheck size={15} /> Desbloquear</> : <><UserRoundX size={15} /> Bloquear</>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      if (!window.confirm("Excluir este usuário e o histórico dele?")) return;
                      await api(`/api/admin/users?id=${item.id}`, { method: "DELETE" });
                      setUsers((list) => list?.filter((u) => u.id !== item.id) ?? null);
                      toast("Usuário excluído.");
                    }}><Trash2 size={15} /> Excluir</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Sugestões e atendimentos</h2>
        {tickets.length === 0 ? <p className="text-sm text-muted">Nenhuma mensagem recebida.</p> : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{ticket.subject} <Badge tone="neutral">{ticket.status}</Badge></p>
                <p className="text-xs text-muted mt-1">{ticket.userName} · {ticket.userEmail}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={reply[ticket.id] ?? ""}
                    onChange={(e) => setReply((r) => ({ ...r, [ticket.id]: e.target.value }))}
                    placeholder="Responder ao usuário..."
                    className="flex-1 h-10 px-3 rounded-lg border border-line bg-card text-sm"
                  />
                  <Button size="sm" onClick={async () => {
                    const message = reply[ticket.id]?.trim();
                    if (!message) return;
                    await api("/api/support", { method: "PATCH", body: JSON.stringify({ ticketId: ticket.id, message }) });
                    setReply((r) => ({ ...r, [ticket.id]: "" }));
                    setTickets((list) => list.map((t) => t.id === ticket.id ? { ...t, status: "answered" } : t));
                    toast("Resposta enviada.");
                  }}>Responder</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
