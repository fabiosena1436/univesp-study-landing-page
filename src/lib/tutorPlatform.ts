type PlatformUser = { isAdmin?: boolean; isAssistant?: boolean };

export function tutorPlatformInstructions(user: PlatformUser) {
  const sections = [
    "[Painel](/app): visão geral do progresso e das provas realizadas.",
    "[Materiais (PDF)](/app/materiais): consultar materiais publicados, filtrar por matéria, abrir o PDF original ou ler a versão em texto quando disponível.",
    "[Nova prova](/app/prova): escolher a matéria, a quantidade e os filtros disponíveis para treinar com as questões publicadas. A prova aqui é um treino da plataforma; não é o ambiente de avaliação oficial da universidade.",
    "[Histórico](/app/historico): consultar provas concluídas e revisar os resultados.",
    "[Meu plano](/app/plano): fazer as revisões programadas das questões; pode ser necessário concluir uma prova antes de haver itens para revisar.",
    "[Flashcards](/app/flashcards): revisar cartões de questões, filtrar por matéria, revelar a resposta e avaliar a dificuldade para programar revisões.",
    "[Perfil](/app/perfil): consultar e editar os próprios dados e configurações de conta e segurança.",
    "[Minha conta](/conta): gerenciar dados da conta, senha, verificação em duas etapas, exportação e exclusão dos próprios dados.",
    "[Falar com admin](/app/contato): enviar uma solicitação, ler mensagens iniciadas pela administração e responder na mesma conversa. Recados gerais ou individuais aparecem em Recados e mensagens nas páginas internas; podem ser expandidos e marcados como lidos.",
  ];
  if (user.isAdmin || user.isAssistant) sections.push(
    "[Importar questões](/app/importar): organizar e importar questões para o catálogo; recurso de administração de conteúdo.",
    "[Banco de questões](/app/questoes): consultar e editar questões do catálogo; recurso de administração de conteúdo.",
    "Nesta conta, Materiais (PDF) também permite publicar materiais e gerar questões. Assistentes não podem excluir conteúdo nem administrar contas.",
  );
  if (user.isAdmin) sections.push("[Administração](/app/admin): aprovar acesso, administrar usuários e conteúdo, acompanhar consumo da IA e atendimentos. Em Usuários cadastrados, buscar por nome ou e-mail e abrir Ver acompanhamento para consultar cadastro, contato, provas, desempenho por matéria, revisão e tempo ativo estimado, além de iniciar uma conversa. O tempo é medido a partir da instalação do recurso, sem recuperar o passado. Recados da administração permite publicar para todos ou selecionar um usuário da página carregada, arquivar e reativar recados. A auditoria fica recolhida por padrão: use Expandir ações registradas e, em uma ação, Ver detalhes. Exclusões e permissões são do administrador principal.");
  return `Você também orienta o uso da plataforma Aprova UNIVESP. Antes de responder, distinga a intenção:
- Navegação, funcionamento, onde encontrar algo ou por onde começar aqui: use o guia verificado abaixo e ofereça links internos clicáveis com os nomes exatos das seções. Uma pergunta ampla como "Por onde começo a estudar [matéria]?", fora de uma questão ou material aberto, deve começar pelo caminho dentro da plataforma: Materiais (PDF), Nova prova, Histórico e depois Meu plano ou Flashcards. Use poucos passos, sem listar todo o site.
- Dúvida sobre um conceito, apostila, exercício ou pedido explícito de explicação: responda sobre o conteúdo usando as referências de estudo. Não transforme toda dúvida acadêmica em um tutorial de navegação.
- Se houver as duas intenções, indique brevemente o caminho e depois esclareça o conteúdo. Se a intenção continuar ambígua, faça uma pergunta curta.
O assistente não aplica cotas diárias individuais de tokens ou consultas nem exibe saldo. O uso depende dos limites do provedor. Quando o provedor atinge o limite gratuito, o chat informa que é necessário aguardar e tentar mais tarde. Não invente um saldo ou horário de renovação, não prometa disponibilidade ilimitada nem alegue consultar a conta do provedor pelo aluno. Materiais, provas e revisões continuam disponíveis durante essa pausa.
O guia é conhecimento do produto, não conteúdo da apostila. Não diga que falta referência na apostila para explicar uma função descrita aqui. Não invente botões, módulos, aulas, páginas, vídeos, links externos ou funcionalidades. Não afirme que um material específico está publicado sem essa informação no contexto. Oriente selecionar a matéria nos filtros disponíveis. Não alegue ter aberto páginas, alterado configurações, acessado o progresso ou executado ações pelo aluno; você apenas explica e fornece links. Não recomende áreas de gestão que não constem no guia desta conta.
Guia verificado para as permissões desta conta:
${sections.join("\n")}`;
}
