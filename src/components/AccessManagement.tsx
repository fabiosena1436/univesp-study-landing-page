"use client";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import { whatsappApprovalUrl } from "@/lib/access";
import { Badge, Button, Select, TextArea } from "./ui";

type Account = { id: string; name: string; email: string; course: string | null; whatsapp: string | null; accessStatus: "pending" | "approved" | "rejected"; emailVerifiedAt: string | null; isBlocked: boolean; createdAt: string };
type Allowed = { email: string };
export default function AccessManagement({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(0);
  const [emailPage, setEmailPage] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allowed, setAllowed] = useState<Allowed[]>([]);
  const [emails, setEmails] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvedNow, setApprovedNow] = useState<Account | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([api<Account[]>(`/api/admin/access?status=${status}&limit=50&offset=${page * 50}`), api<Allowed[]>(`/api/admin/authorized-emails?limit=50&offset=${emailPage * 50}`)])
      .then(([accounts, allowed]) => { if (alive) { setAccounts(accounts); setAllowed(allowed); setError(""); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Não foi possível carregar os acessos."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status, page, emailPage, revision]);
  async function mutate(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setRevision(r => r + 1); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  function whatsapp(account: Account) { return whatsappApprovalUrl(account.whatsapp, account.name, window.location.origin); }
  return <section className="card p-5 space-y-6">
    <h2 className="font-semibold text-xl">Aprovação de acesso</h2>
    <p className="text-sm text-muted">A aprovação libera o conteúdo para o aluno. Contas bloqueadas continuam sem acesso.</p>
    <div className="flex flex-wrap gap-3 items-center"><label htmlFor="access-status">Cadastros</label><Select id="access-status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); setLoading(true); }}><option value="pending">Aguardando aprovação</option><option value="approved">Autorizados</option><option value="rejected">Recusados</option></Select><Button disabled={busy} variant="ghost" onClick={() => setRevision(r => r + 1)}>Atualizar</Button></div>
    {error && <p role="alert" className="text-red">{error}</p>}
    {notice && <p role="status" className="text-pen">{notice}</p>}
    {approvedNow && <div className="rounded-xl bg-green-soft p-4"><p>Acesso de {approvedNow.name} autorizado.</p>{whatsapp(approvedNow) && <a className="inline-block mt-2 font-semibold underline" href={whatsapp(approvedNow)!} target="_blank" rel="noopener noreferrer">Avisar {approvedNow.name} pelo WhatsApp</a>}<p className="text-sm mt-2">O botão abre uma mensagem pronta. Confira e envie pelo seu WhatsApp.</p></div>}
    {loading ? <p role="status">Carregando cadastros…</p> : accounts.length === 0 ? <p>Nenhum cadastro nesta página.</p> : accounts.map(account => <div key={account.id} className="border-b border-line pb-4 space-y-2">
      <p className="font-semibold">{account.name} {account.isBlocked && <Badge tone="red">Bloqueado</Badge>}</p><p className="text-sm break-all">{account.email} · {account.course}</p><p className="text-sm">WhatsApp: {account.whatsapp ?? "Não informado"}</p><p className="text-xs text-muted">Cadastro: {formatDate(account.createdAt)}</p>
      <div className="flex flex-wrap gap-2">{account.accessStatus !== "approved" && <Button disabled={busy} onClick={() => mutate(async () => { await api("/api/admin/access", { method: "PATCH", body: JSON.stringify({ id: account.id, status: "approved" }) }); setApprovedNow(account); setNotice("Acesso aprovado. O aluno já pode entrar."); })}>Aprovar</Button>}
        {account.accessStatus !== "rejected" && <Button disabled={busy} variant="ghost" onClick={() => mutate(async () => { await api("/api/admin/access", { method: "PATCH", body: JSON.stringify({ id: account.id, status: "rejected" }) }); setNotice("Cadastro recusado."); setApprovedNow(null); })}>Recusar acesso</Button>}
        {account.accessStatus === "approved" && whatsapp(account) && <a className="inline-flex items-center px-3 underline text-sm" href={whatsapp(account)!} target="_blank" rel="noopener noreferrer">Avisar pelo WhatsApp</a>}
      </div>
    </div>)}
    <div className="flex gap-3 items-center"><Button disabled={busy || page === 0} variant="ghost" onClick={() => setPage(p => p - 1)}>Anterior</Button><span>Página {page + 1}</span><Button disabled={busy || accounts.length < 50} variant="ghost" onClick={() => setPage(p => p + 1)}>Próxima</Button></div>
    <div className="border-t border-line pt-5 space-y-3"><h3 className="font-semibold text-lg">E-mails pré-autorizados</h3><p className="text-sm">Cole até 500 e-mails, um por linha. Também aceitamos vírgula ou ponto e vírgula. Contas pendentes desses endereços serão aprovadas; contas recusadas ou bloqueadas não serão reativadas.</p>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void mutate(async () => { const result = await api<{ added: number; duplicates: number }>("/api/admin/authorized-emails", { method: "POST", body: JSON.stringify({ emails }) }); setEmails(""); setEmailPage(0); setNotice(`${result.added} e-mails adicionados. ${result.duplicates} já estavam na lista.`); }); }}>
        <label className="block text-sm font-semibold" htmlFor="authorized-emails">Lista de e-mails</label><TextArea id="authorized-emails" required rows={5} maxLength={100000} placeholder="aluno@aluno.univesp.br" value={emails} onChange={e => setEmails(e.target.value)} /><Button type="submit" disabled={busy}>Adicionar e-mails</Button>
      </form>
      <p className="text-xs text-muted">Remover um e-mail da lista não revoga uma conta já autorizada. Para isso, use Recusar acesso ou Bloquear nos usuários cadastrados.</p>
      {allowed.map(item => <div key={item.email} className="flex flex-wrap gap-3 items-center border-b border-line py-2"><span className="flex-1 break-all">{item.email}</span><Button disabled={busy} variant="ghost" onClick={() => mutate(async () => { await api(`/api/admin/authorized-emails?email=${encodeURIComponent(item.email)}`, { method: "DELETE" }); setNotice("E-mail removido da lista."); })}>Remover da lista</Button></div>)}
      <div className="flex gap-3 items-center"><Button disabled={busy || emailPage === 0} variant="ghost" onClick={() => setEmailPage(p => p - 1)}>Anterior</Button><span>Página {emailPage + 1}</span><Button disabled={busy || allowed.length < 50} variant="ghost" onClick={() => setEmailPage(p => p + 1)}>Próxima</Button></div>
    </div>
  </section>;
}
