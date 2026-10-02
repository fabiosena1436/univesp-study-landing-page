# Aprova UNIVESP

Aplicação de estudos com catálogo compartilhado de matérias e questões, publicação por administradores e histórico individual. Next.js 16, React 19, TypeScript, PostgreSQL e Drizzle. Responsável: Fabio VSena — fabiosena1436@gmail.com.

Para publicar pelo GitHub com Vercel e Neon, siga [o guia de deploy](DEPLOY-VERCEL-NEON.md).

## Ambiente local

Use Node.js 22 e Docker Desktop. Instale as dependências com `npm ci`.

```powershell
Copy-Item .env.example .env.local
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Abra http://localhost:3000. O PostgreSQL local usa a porta 55432, restrita a 127.0.0.1. As credenciais do compose são exclusivas para desenvolvimento.

O cadastro requer `APP_URL`, `RESEND_API_KEY` e `RESEND_FROM_EMAIL` com domínio verificado. A conta é liberada somente após a confirmação do e-mail institucional. Falhas de envio não revelam se um endereço está cadastrado; a página `/confirmar-email` permite solicitar outro link.

Em produção, `APP_URL` deve ser HTTPS. Configure `TZ=UTC` no processo Node e dimensione `DB_POOL_MAX` conforme o limite de conexões do banco. Não use as credenciais de desenvolvimento em produção.

## Banco existente e migrações

As migrações versionadas estão em `migrations/`. `npm run db:migrate` aplica alterações em transações, verifica checksums e usa um lock para evitar execuções concorrentes. Para um banco previamente criado com `drizzle-kit push`, faça backup e execute:

```powershell
npm run db:migrate -- --adopt-legacy
```

A adoção valida a estrutura inicial antes de registrá-la. A migração preenche cópias históricas de questões, agrega o progresso duplicado e converte tokens de sessão para hashes. Administradores existentes mantêm acesso; alunos existentes precisam confirmar o e-mail. Dados antigos que violam as novas regras de contagem fazem a migração falhar e voltar a transação; inspecione esses registros antes de tentar novamente.

Não execute `drizzle-kit push` em produção. Para próximas mudanças, altere o schema, execute `npm run db:generate`, revise o SQL e inclua qualquer preenchimento de dados necessário antes de aplicar. As migrações não devem ser editadas depois de aplicadas.

## Primeiro administrador

Cadastre e confirme a posse de um e-mail institucional. Em um terminal autorizado com acesso ao banco:

```powershell
npm run db:admin -- seu-email@aluno.univesp.br
```

O comando exige e-mail já confirmado e registra a promoção na auditoria. A aplicação impede exclusão da última conta administrativa. O endereço pessoal do responsável é contato do serviço, não um desvio da regra de cadastro institucional.

## Comportamento e integridade

- Acertos são calculados no servidor; respostas repetidas ou de outra matéria são rejeitadas.
- Prova, respostas e progresso são gravados na mesma transação. `submissionId` evita provas duplicadas em tentativas repetidas de envio.
- Matérias, materiais e questões são arquivados. As provas guardam cópias do conteúdo e do nome da matéria.
- A exclusão de um autor não apaga o catálogo: o vínculo de autoria passa a nulo.
- Revisões usam atualização atômica com unicidade por aluno/questão.
- Sessões e links de confirmação/recuperação usam tokens aleatórios armazenados como hash. Troca de senha revoga outras sessões e links pendentes.
- Limites de uso ficam no PostgreSQL e são compartilhados por instâncias. Há limites globais para as rotas públicas e por identidade para operações de conta. Proteção de tráfego volumoso também deve ser configurada na infraestrutura de hospedagem.
- O modo atual é estudo, com gabarito disponível para feedback imediato. Não é uma avaliação oficial ou ambiente antifraude.
- Uma prova em andamento é guardada em `sessionStorage`, por usuário, por até 24 horas. Navegação e retomada não garantem recuperação se o navegador apagar o armazenamento. Falhas de salvamento mantêm o treino disponível para tentar novamente.

## IA e PDFs

Sem `GEMINI_API_KEY`, a extração local preserva questões estruturadas existentes; não cria questões de conteúdo livre. PDFs digitalizados precisam de texto selecionável: OCR não está implementado.

Com Gemini, configure `GEMINI_MODELS` com um ou dois códigos separados por vírgula. O padrão é `gemini-2.5-flash`; confirme disponibilidade e cotas na sua conta. Referência oficial: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash.

A geração tem prazo total de 95 segundos e exige cinco alternativas únicas, gabarito válido e trecho de origem encontrado no material. Materiais grandes são amostrados em trechos distribuídos e recebem aviso de cobertura parcial. Isso verifica a existência do trecho, não garante que o raciocínio da IA esteja correto: o administrador precisa conferir os rascunhos no editor antes de publicar.

PDFs têm limite de 20 MB e 500 páginas; texto extraído tem limite de 400 mil caracteres. Apenas o texto extraído é armazenado, não o arquivo PDF original. Hospedagens com limites menores de upload precisam de armazenamento de arquivos e processamento separado; o compose é para banco local, não um deploy completo.

## Qualidade e testes

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Testes de integração usam um banco separado e um servidor de produção na porta 3100:

```powershell
docker compose -f docker-compose.test.yml -p aprova-quality up -d
npm run db:test:setup
npm run build
npm run test:e2e
```

`db:test:setup` cria um banco novo chamado `aprova_test_<timestamp>`, preenche uma estrutura antiga e testa a atualização. Nunca utiliza o banco da aplicação. `.test-env.json` contém apenas configuração e credenciais descartáveis de teste, fica ignorado pelo Git e não deve ser publicado. O servidor de teste desativa Gemini e Resend, sem enviar e-mails ou consumir APIs externas. Para inspecionar no navegador, use `npm run test:server` após o build. Uma nova execução de `db:test:setup` prepara dados novos; a suíte altera as contas de teste.

O CI executa verificações estáticas, testes unitários, migração de banco antigo, build e testes de APIs contra PostgreSQL. Verificação visual no navegador complementa essa suíte.

## Operação, backup e restauração

`npm run doctor` verifica configuração sem exibir segredos e detecta se o banco foi atualizado. Logs de erros são JSON com ID de referência; não incluem consultas, tokens ou dados pessoais. `/api/health` verifica conexão com o banco. Ações administrativas ficam em `/app/admin`, na seção Auditoria.

Execute diariamente `npm run db:cleanup`. A rotina remove sessões e tokens expirados, limites vencidos e auditoria com mais de 90 dias. Configure esse comando no agendador da sua hospedagem; o repositório não instala tarefas no computador nem provisiona serviços externos.

Com os utilitários PostgreSQL (`pg_dump`, `pg_restore`) instalados:

```powershell
npm run db:backup
```

Se o banco está em um contêiner local e os utilitários PostgreSQL não estão instalados no Windows:

```powershell
npm run db:backup -- repete-postgres
```

Use o nome real do seu contêiner. O script confere se a porta publicada corresponde ao `DATABASE_URL`, verifica o catálogo do dump e só publica o arquivo completo após a cópia terminar. Credenciais não são colocadas na linha de comando. Um backup que falha não inicia a limpeza dos arquivos anteriores.

Para testar a restauração integral no serviço isolado do projeto:

```powershell
docker compose -f docker-compose.test.yml -p aprova-quality up -d
npm run db:restore:verify -- backups/<arquivo>.dump
docker compose -f docker-compose.test.yml -p aprova-quality stop
```

Esse comando exige um arquivo dentro de `backups/`, usa exclusivamente o contêiner `aprova-quality-postgres-1` na porta local 55439 e cria um banco `aprova_test_restore_<timestamp>`. Restaura o dump, aplica migrações e verifica preservação de registros, totais de progresso e snapshots históricos. A cópia é mantida para inspeção; contém os mesmos dados pessoais do backup e não deve ser publicada. O banco principal não é alterado.

O script salva arquivos custom em `backups/` e remove somente backups gerados por ele com mais de 30 dias, depois de um backup bem-sucedido. Restrinja acesso a essa pasta e mantenha uma cópia criptografada fora do servidor. Para restauração, use um banco vazio separado:

```powershell
pg_restore --no-owner --no-acl --dbname=<URL_DO_BANCO_DE_RESTAURACAO> backups/<arquivo>.dump
```

Confirme as tabelas e execute testes de login, catálogo e histórico no banco restaurado antes de substituir o banco de produção. Não restaure diretamente sobre dados existentes. Se os utilitários não estiverem instalados no Windows, o PostgreSQL do Docker os oferece: use `docker compose exec -T postgres pg_dump -U app -d app_db -Fc -f /tmp/aprova-backup.dump` e `docker compose cp postgres:/tmp/aprova-backup.dump backups/aprova-backup.dump`.

## Privacidade e limites operacionais

As páginas `/privacidade` e `/termos` descrevem os recursos implementados e identificam o responsável. O perfil oferece exportação de dados e exclusão com confirmação de senha. Prazos de limpeza e retenção dependem da execução das rotinas documentadas. A implantação deve configurar banco, domínio HTTPS, envio de e-mail, monitoramento de logs, backups e seus agendamentos; essas configurações externas não são criadas pelo código.
