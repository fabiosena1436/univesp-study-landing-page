# Aprovação de acesso

Antes de publicar a nova versão, aplique a migração com `npm run db:migrate` no ambiente correto, depois do backup. A migração `0002_wise_virginia_dare.sql` preserva o acesso das contas existentes, marcando-as como autorizadas e dispensadas da nova confirmação. Novos cadastros precisam confirmar o e-mail e receber autorização.

Na Vercel, `vercel.json` executa `scripts/vercel-build.mjs`: somente em produção, verifica a configuração de e-mail e o domínio, aplica as migrações versionadas e depois executa o build. Em endpoints Neon com pool, usa a conexão direta correspondente sem copiar as credenciais para o computador. Pré-publicações não alteram o banco por esse script. Uma falha interrompe o build e mantém a versão anterior no ar; as migrações aditivas concluídas permanecem compatíveis com essa versão.

## Para o administrador

Abra **Administração → Aprovação de acesso**.

- Em **E-mails pré-autorizados**, cole até 500 endereços, um por linha. Vírgula e ponto e vírgula também são aceitos. Os endereços são normalizados e duplicados não são inseridos.
- Um cadastro com e-mail dessa lista fica pré-autorizado, mas o aluno ainda precisa confirmar o endereço pelo link recebido.
- Adicionar um endereço depois do cadastro aprova a conta pendente. Contas recusadas não são aprovadas automaticamente; bloqueios continuam valendo.
- Em **Aguardando aprovação**, confira nome, e-mail, curso, WhatsApp e situação da confirmação. Use **Aprovar** ou **Recusar acesso**.
- Após aprovar, use **Avisar pelo WhatsApp**. O botão abre uma conversa com texto pronto. Você confere e envia manualmente; o site não envia mensagens automaticamente.
- Use os filtros **Autorizados** e **Recusados** para rever decisões. O bloqueio continua disponível em Usuários cadastrados.
- Remover um e-mail da lista impede sua pré-autorização em novos cadastros, mas não revoga aprovações existentes. Para revogar, recuse o acesso ou bloqueie a conta.

## Para o aluno

O cadastro aceita um e-mail válido, preferencialmente institucional, e pede WhatsApp brasileiro com DDD. Após criar a conta, o aluno vê `/aguardando-aprovacao`, com as duas etapas separadas. Pode reenviar a confirmação, consultar o acesso e sair. A confirmação exige um clique no botão da página, evitando consumo automático por prévias e verificadores de links de e-mail.

Os links são de uso único, armazenados como hash e expiram em 24 horas. Reenviar invalida links anteriores. Há limite de três reenvios por hora por conta. Aprovar não confirma o e-mail. Recusar ou bloquear retira o acesso às APIs mesmo de sessões que já estavam abertas. A página inicial continua pública.

## Configuração de envio

Configure `APP_URL` com o endereço HTTPS público, `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com um domínio de envio validado. O Resend é necessário para a confirmação e a recuperação de senha. Falha no envio preserva a conta, informa o problema e mantém o conteúdo protegido até a confirmação. Nenhum token aparece nas respostas de cadastro ou nos logs.

Os testes de integração usam PostgreSQL isolado e respostas simuladas do Resend. Eles não enviam e-mails reais nem mensagens de WhatsApp.
