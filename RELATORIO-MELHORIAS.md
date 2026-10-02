# Aprova UNIVESP — revisão e correções

Verificado em 2 de outubro de 2026. O produto mantém um catálogo compartilhado, publicado por administradores, e histórico individual por aluno.

## Problemas críticos corrigidos

- Resultados de provas eram confiados ao cliente: o servidor agora valida cada resposta e calcula os acertos pelo gabarito armazenado.
- Envios repetidos podiam duplicar provas: identificador de submissão, transação e bloqueio no banco garantem idempotência.
- Atualizações simultâneas de revisão podiam perder contadores: progresso único por aluno/questão com atualização atômica.
- Exclusão de conteúdo podia destruir o histórico: conteúdo é arquivado e cada resposta conserva uma cópia da questão utilizada.
- Sessões eram armazenadas como tokens utilizáveis: agora são armazenados hashes. Alteração e recuperação de senha revogam sessões anteriores.
- E-mail institucional não era confirmado: cadastro pendente, confirmação com token de uso único e reenvio limitado. Administradores legados foram confirmados na migração; alunos legados precisam confirmar o endereço.
- Limites de requisição não eram persistentes: limites no PostgreSQL sobrevivem a reinícios e múltiplas instâncias.
- Importações podiam misturar matéria/material e aceitar alternativas inválidas: validação integral e publicação em transação, com deduplicação por fingerprint.
- Geração podia dar aparência de confiança a questões sem fundamentação: respostas da IA são validadas e precisam incluir trecho literal do material; revisão humana continua necessária.

## Melhorias de produto e operação

- Nome Aprova UNIVESP e contato Fabio VSena / fabiosena1436@gmail.com.
- Proteção no servidor das páginas e das operações administrativas, proteção de origem nas APIs e mensagens de erro sanitizadas.
- Rascunho de simulado por aluno, retomada da alternativa selecionada, tentativa de salvamento recuperável e resultado final vindo do servidor.
- Paginação de catálogo, materiais, histórico, usuários, suporte e auditoria; consultas de quiz limitadas no banco.
- Exportação dos dados pessoais e exclusão de conta autenticada, preservando materiais compartilhados e protegendo o último administrador.
- Termos, privacidade, estados de carregamento/erro e melhorias de acessibilidade.
- Migrações versionadas, diagnóstico de ambiente, ferramentas de administrador, limpeza por retenção e backup.
- CI com lint, verificação de tipos, testes, migração e build. A execução remota depende do envio do repositório.

## Validação realizada

- Lint e build de produção aprovados, incluindo a verificação de TypeScript.
- 13 testes unitários aprovados.
- 16 cenários de integração aprovados contra PostgreSQL isolado, incluindo concorrência, autorização, migração do legado, idempotência, recuperação, exportação e exclusão.
- No Edge: login, seleção automática da matéria, simulado, restauração após navegar para outra página, correção, salvamento e resultado no histórico.
- Banco local real migrado com sucesso; diagnóstico confirmou conexão, registro de migrações e novo esquema.
- Backup atualizado criado pelo comando Docker em `backups/aprova-20261002T174645Z.dump` e restaurado integralmente no banco isolado. Lint aprovado; o verificador rejeitou um arquivo fora da pasta/formato permitido.
- Backup anterior à migração em `backups/aprova-before-upgrade-20261002.dump`; formato e catálogo verificados. Restauração integral exercitada em banco isolado: migração aprovada, quantidades de registros e totais de progresso preservados, snapshots históricos preenchidos. O comando `db:restore:verify` permite repetir a verificação.
- Testes não enviaram e-mails reais nem consumiram a API Gemini. A integração com Gemini foi testada com resposta simulada, incluindo proteção da chave e validação do conteúdo.

## Pendências externas

1. Configurar `RESEND_API_KEY` e `RESEND_FROM_EMAIL` em `.env.local` e no ambiente de hospedagem. O remetente precisa estar autorizado no Resend. Sem isso, cadastro e envio de confirmação/recuperação permanecem indisponíveis, com erro explícito.
2. Na hospedagem, configurar `APP_URL` com o domínio HTTPS real e credenciais próprias; localmente está definido como `http://localhost:3000`.
3. Agendar `db:backup` e `db:cleanup` e armazenar uma cópia do backup fora da máquina. A restauração local foi exercitada; repetir periodicamente no ambiente de hospedagem. Os comandos e a retenção estão documentados no README.
4. Validar entrega real de e-mail e uma geração Gemini no ambiente configurado. Não foi realizado deploy.

## Complexidade que não foi acrescentada

Não há necessidade demonstrada de Kubernetes, microsserviços, bancos vetoriais/RAG, múltiplos agentes, Web3 ou fine-tuning para este escopo. Next.js e PostgreSQL atendem o fluxo atual. OCR para PDFs digitalizados continua sendo uma extensão opcional; PDFs com texto extraível e importação estruturada são suportados.

IA não garante ausência de alucinações, e sistemas não têm latência zero ou escala infinita. Trechos de origem e validação reduzem erros estruturais, mas a publicação continua dependendo do julgamento do administrador.
