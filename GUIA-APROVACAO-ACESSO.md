# Aprovação de acesso e administradores assistentes

Aplique as migrações versionadas antes de executar a nova versão. A migração `0003_assistant_and_pdf.sql` adiciona a função de assistente e a tabela dos PDFs originais. Na Vercel, o script de build existente aplica as migrações somente em produção antes do build; pré-publicações não alteram o banco.

## Para o administrador principal

Abra **Administração → Aprovação de acesso**.

- Em **E-mails pré-autorizados**, cole até 500 endereços institucionais @aluno.univesp.br. Um cadastro dessa lista já pode entrar no conteúdo, sem confirmação de e-mail.
- Fora da lista, o cadastro aguarda sua aprovação. Confira nome, e-mail, curso e WhatsApp e use **Aprovar** ou **Recusar acesso**.
- Adicionar um e-mail depois do cadastro aprova a conta pendente. Contas recusadas precisam de aprovação manual; bloqueios continuam valendo.
- Após aprovar, **Avisar pelo WhatsApp** abre uma conversa com mensagem pronta. Você confere e envia manualmente.
- Remover um e-mail da lista não revoga aprovações existentes. Para retirar o acesso, recuse ou bloqueie a conta.

Em **Usuários cadastrados**, use **Tornar assistente** para uma conta aprovada e desbloqueada. **Remover assistente** revoga a função, inclusive nas sessões abertas.

Assistentes podem adicionar e editar matérias, questões e materiais, gerar questões e anexar PDFs. Somente o administrador principal pode excluir conteúdo, administrar contas, aprovar cadastros, gerenciar permissões, responder atendimentos como administrador e consultar auditoria e uso de IA. As APIs verificam essas restrições.

## Para o aluno

O cadastro aceita somente e-mail institucional com domínio @aluno.univesp.br, sem exceções para e-mails pessoais, e pede curso, senha e WhatsApp brasileiro com DDD. Não há confirmação de e-mail. Contas pré-autorizadas entram diretamente; as demais veem `/aguardando-aprovacao`. A tela consulta o acesso a cada 15 segundos, além do botão **Consultar acesso**. Aprovação libera o conteúdo, e recusa ou bloqueio impede as APIs de estudo.

Em **Materiais**, abra o material e use **Visualizar PDF**, **Abrir PDF em nova aba** ou **Baixar PDF** quando houver anexo. Materiais antigos conservam seu texto; o administrador ou assistente pode anexar o arquivo original posteriormente.

## PDFs e envio de e-mail

PDFs originais são armazenados no PostgreSQL em uma tabela separada, sem carregar o arquivo nas listagens. Uploads aceitam até 4 MB e 500 páginas. PDFs digitalizados podem ser lidos, mas gerar questões exige texto selecionável ou conteúdo adicionado manualmente. Editar o texto não altera o arquivo anexado.

O Resend continua sendo usado para recuperação de senha. Configure `APP_URL`, `RESEND_API_KEY` e `RESEND_FROM_EMAIL` para esse envio. O cadastro não depende de envio de e-mail. Rotas antigas de confirmação permanecem compatíveis com links anteriores e não condicionam o acesso.

Os testes de integração usam PostgreSQL isolado e respostas simuladas do Resend, sem enviar e-mails reais ou mensagens de WhatsApp.
