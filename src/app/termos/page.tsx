import Link from "next/link";

export default function Termos() {
  return <main className="max-w-3xl mx-auto p-6 md:p-12 space-y-6 leading-relaxed">
    <Link href="/" className="text-pen underline">Aprova UNIVESP</Link>
    <h1 className="font-display text-3xl">Termos de uso</h1>
    <p>O Aprova UNIVESP é um serviço de estudos mantido por Fabio VSena, contato <a className="underline" href="mailto:fabiosena1436@gmail.com">fabiosena1436@gmail.com</a>. Este projeto não declara vínculo oficial com a UNIVESP.</p>
    <h2 className="text-xl font-semibold">Conta e acesso</h2>
    <p>O cadastro aceita e-mails institucionais com final @aluno.univesp.br. O acesso ao conteúdo depende da autorização do administrador; e-mails pré-autorizados podem receber acesso imediato. Não é preciso confirmar o endereço por e-mail no cadastro. O WhatsApp com DDD permite ao administrador avisar manualmente sobre a autorização. O e-mail é usado para entrar e recuperar a senha. Proteja sua senha e use somente uma conta que você controla. Administradores publicam e revisam o catálogo; assistentes podem adicionar e gerenciar provas e materiais, sem administrar contas ou excluir conteúdo. Alunos respondem questões e acompanham o próprio progresso.</p>
    <h2 className="text-xl font-semibold">Conteúdo de estudo</h2>
    <p>Questões e explicações são auxiliares de estudo. Respostas geradas por IA podem conter erros e precisam de revisão antes da publicação. Estatísticas de treino não constituem notas oficiais nem garantia de aprovação. Use os canais de contato para informar erros.</p>
    <h2 className="text-xl font-semibold">Publicação responsável</h2>
    <p>Publique somente materiais que você tenha autorização para compartilhar. Evite dados pessoais, conteúdo ofensivo, tentativas de acesso indevido e uso que prejudique o serviço. Conteúdo pode ser arquivado para correção e contas podem ser bloqueadas pelo administrador.</p>
    <h2 className="text-xl font-semibold">Disponibilidade e saída</h2>
    <p>O serviço pode passar por manutenção. Você pode exportar seus dados e encerrar a conta em Minha conta, inclusive enquanto aguarda aprovação. Dúvidas e pedidos sobre sua conta podem ser encaminhados ao responsável.</p>
    <Link href="/privacidade" className="text-pen underline">Política de privacidade</Link>
    <p className="text-sm text-muted">Atualizados em 13 de outubro de 2026.</p>
  </main>;
}
