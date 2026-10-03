import Link from "next/link";
import AuthShell from "@/components/AuthShell";
export default function ConfirmarEmail() {
  return <AuthShell><h1 className="font-display text-3xl">Seu cadastro não precisa de confirmação</h1><p className="mt-3 text-muted">O acesso por e-mail e senha é liberado após criar a conta. Não é necessário receber ou abrir um link.</p><Link className="block mt-6 text-pen underline" href="/entrar">Entrar na minha conta</Link><Link className="block mt-4 text-pen underline" href="/cadastro">Criar conta</Link></AuthShell>;
}
