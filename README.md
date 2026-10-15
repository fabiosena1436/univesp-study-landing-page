# Aprova UNIVESP

Aplicação de estudos com catálogo compartilhado de matérias e questões, publicação por administradores e histórico individual. Next.js 16, React 19, TypeScript, PostgreSQL e Drizzle. Responsável: Fabio VSena — fabiosena1436@gmail.com.

Para publicar pelo GitHub com Vercel e Neon, siga [o guia de deploy](DEPLOY-VERCEL-NEON.md).

Veja também a [auditoria de arquitetura](AUDITORIA-ARQUITETURA-2026.md) e o [registro da evolução técnica e das verificações](IMPLEMENTACAO-QUALIDADE-2026.md).

Se nunca publicou um projeto, use primeiro [o passo a passo para iniciantes](GUIA-INICIANTE-PUBLICACAO.md), com telas, campos, comandos e conferência de cada etapa.

## Ambiente local

Use Node.js 22 e Docker Desktop. Instale as dependências com `npm ci`.

```powershell
Copy-Item .env.example .env.local
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Abra http://localhost:3000. O PostgreSQL local usa a porta 15432, restrita a 127.0.0.1. As credenciais do compose são exclusivas para desenvolvimento. A porta anterior, 55432, pode estar reservada pelo Windows; nesse caso, atualize também a porta da URL em `.env.local`.

Novos cadastros aceitam somente e-mails @aluno.univesp.br e precisam ter acesso autorizado pelo administrador, sem confirmação de e-mail. A lista de e-mails pré-autorizados permite inclusão em lote no painel administrativo. Quem estiver fora da lista cria uma conta pendente e vê uma tela de espera. O cadastro pede WhatsApp com DDD para aviso manual sobre a aprovação. O Resend envia a recuperação de senha. A migração preserva o acesso das contas existentes. Veja [o guia de aprovação](GUIA-APROVACAO-ACESSO.md). Cadastre 26241463@aluno.univesp.br para a conta administrativa e promova-a pelo comando abaixo.

Em produção, `APP_URL` deve ser HTTPS. Configure `TZ=UTC` no processo Node e dimensione `DB_POOL_MAX` conforme o limite de conexões do banco. Não use as credenciais de desenvolvimento em produção.

## Banco existente e migrações

As migrações versionadas estão em `migrations/`. `npm run db:migrate` aplica alterações em transações, verifica checksums e usa um lock para evitar execuções concorrentes. Para um banco previamente criado com `drizzle-kit push`, faça backup e execute:

```powershell
npm run db:migrate -- --adopt-legacy
```

A adoção valida a estrutura inicial antes de registrá-la. A migração preenche cópias históricas de questões, agrega o progresso duplicado e converte tokens de sessão para hashes. Contas aprovadas têm acesso independentemente de email_verified_at; bloqueios e senhas continuam sendo verificados. Dados antigos que violam as novas regras de contagem fazem a migração falhar e voltar a transação; inspecione esses registros antes de tentar novamente.

Não execute `drizzle-kit push` em produção. Para próximas mudanças, altere o schema, execute `npm run db:generate`, revise o SQL e inclua qualquer preenchimento de dados necessário antes de aplicar. As migrações não devem ser editadas depois de aplicadas.

## Primeiro administrador

Cadastre a conta institucional que será administradora. Para este projeto, use 26241463@aluno.univesp.br. Em um terminal autorizado com acesso ao banco:

```powershell
npm run db:admin -- 26241463@aluno.univesp.br
```

O comando exige uma conta existente e não bloqueada e registra a promoção na auditoria. A aplicação impede exclusão da última conta administrativa. Novos cadastros aceitam exclusivamente o domínio @aluno.univesp.br, sem exceções para e-mails pessoais. O cadastro não concede acesso administrativo automaticamente.

## Comportamento e integridade

- Acertos são calculados no servidor; respostas repetidas ou de outra matéria são rejeitadas.
- Prova, respostas e progresso são gravados na mesma transação. `submissionId` evita provas duplicadas em tentativas repetidas de envio.
- Matérias, materiais e questões são arquivados. As provas guardam cópias do conteúdo e do nome da matéria.
- A exclusão de um autor não apaga o catálogo: o vínculo de autoria passa a nulo.
- Revisões usam atualização atômica com unicidade por aluno/questão.
- Sessões e links de recuperação usam tokens aleatórios armazenados como hash. Troca de senha revoga outras sessões e links pendentes.
- Limites de uso ficam no PostgreSQL e são compartilhados por instâncias. Há limites globais para as rotas públicas e por identidade para operações de conta. Proteção de tráfego volumoso também deve ser configurada na infraestrutura de hospedagem.
- O modo atual é estudo, com gabarito disponível para feedback imediato. Não é uma avaliação oficial ou ambiente antifraude.
- Uma prova em andamento é guardada em `sessionStorage`, por usuário, por até 24 horas. Navegação e retomada não garantem recuperação se o navegador apagar o armazenamento. Falhas de salvamento mantêm o treino disponível para tentar novamente.

## IA e PDFs

O assistente dos alunos usa **Groq**, enquanto a geração e o preenchimento de questões continuam no **Gemini**, com cotas independentes entre os provedores. Crie uma chave em https://console.groq.com/keys e adicione `GROQ_API_KEY` somente no ambiente do servidor (`.env.local` e nas variáveis da hospedagem). O modelo padrão é `openai/gpt-oss-120b`; para alterá-lo, configure `GROQ_TUTOR_MODEL` com um modelo de texto disponível na sua conta. A antiga variável `AI_TUTOR_MODEL` não é mais utilizada. Reinicie o servidor local ou reimplante após configurar. Sem a chave Groq, o assistente informa indisponibilidade; não usa a chave Gemini como alternativa.

O plano gratuito Groq tem limites próprios de solicitações e tokens, compartilhados por organização; consulte https://console.groq.com/settings/limits para confirmar os limites da sua conta. Referência: https://console.groq.com/docs/rate-limits. O histórico, a pergunta e os trechos de estudo do assistente são enviados ao Groq. Os controles internos de mensagens e os orçamentos compartilhados `AI_USER_DAILY_TOKEN_BUDGET` e `AI_MONTHLY_TOKEN_BUDGET` continuam ativos. O painel administrativo contabiliza chamadas dos dois provedores e preserva os registros anteriores do Gemini.

Sem `GEMINI_API_KEY`, a extração local preserva questões estruturadas existentes; não cria questões de conteúdo livre. PDFs digitalizados podem ser disponibilizados para leitura; para extrair conteúdo e gerar questões, precisam de texto selecionável ou conteúdo colado manualmente. OCR não está implementado.

Com Gemini, configure `GEMINI_MODELS` com um ou dois códigos separados por vírgula. O padrão para geração de questões é `gemini-3.6-flash,gemini-3.5-flash-lite`; o segundo modelo é uma alternativa se o primeiro estiver indisponível. Confirme disponibilidade e cotas na sua conta. Referência oficial: https://ai.google.dev/gemini-api/docs/models.

Alunos aprovados podem abrir o **Assistente IA** em todas as páginas internas. O assistente identifica a página atual. Em Meu plano, Flashcards e na prova, acompanha automaticamente a questão ou cartão ativo; na leitura, acompanha o material aberto. Ao mudar de página, questão, cartão ou material, a conversa reinicia para evitar contexto antigo. Fora dessas atividades, é possível selecionar a matéria no chat e pedir orientação sobre a plataforma mesmo sem matéria selecionada. O servidor consulta o enunciado e as referências pelo identificador; o cliente não envia o gabarito. O botão apresenta um robô animado e respeita a preferência por movimento reduzido. O assistente usa o AI SDK com o Groq configurado no servidor, mostra sugestões conforme a matéria e responde com base em trechos de texto do material e no enunciado da questão, quando disponíveis. Na prova, recebe apenas enunciado e trechos de referência; alternativas e gabarito não são enviados. As respostas podem conter erros, e o assistente não substitui a revisão do conteúdo. O chat não é salvo; a pergunta, as últimas seis mensagens e o contexto de estudo são enviados ao Groq para produzir cada resposta. PDFs sem texto copiado ou extraído não fornecem conteúdo ao assistente. Sem `GROQ_API_KEY`, o chat informa que está indisponível.

O chat limita cada aluno a oito perguntas por minuto e, por padrão, **20 consultas e 20 mil tokens por dia** (`AI_TUTOR_DAILY_MESSAGES` e `AI_TUTOR_USER_DAILY_TOKENS`). A comunidade compartilha uma reserva diária de **180 mil tokens e 900 tentativas** (`AI_TUTOR_SHARED_DAILY_TOKENS` e `AI_TUTOR_SHARED_DAILY_MESSAGES`). O período vira à meia-noite UTC (21h do dia anterior em Brasília), indicado no chat. Vale o primeiro limite atingido. Esses valores são configuráveis e não garantem 20 respostas: contexto, histórico e resposta consomem tokens; o provedor pode bloquear antes por limites de minuto ou consumo externo ao site. Também continuam ativos o orçamento mensal e o limite global de 100 perguntas por minuto. Cada resposta tem prazo de 45 segundos e limite de 750 tokens de saída.

As reservas são atômicas no PostgreSQL. Reservam bytes do pedido mais margem de saída, depois acertam o consumo com os tokens informados pelo provedor. Rejeições conhecidas não descontam tokens nem consultas pessoais; a tentativa compartilhada permanece contada. Sem consumo informado, a reserva conservadora é mantida. O saldo não equivale a faturamento ou ao saldo da conta Groq.

Exemplo de planejamento: com 180 mil tokens compartilhados e média de 2 mil tokens por resposta, caberiam aproximadamente 90 respostas por dia no site. Reservas conservadoras e limites do provedor podem reduzir esse total. Ajuste os orçamentos aos limites reais da organização no Groq.

Os comandos `npm run dev`, `npm run build` e `npm run start` iniciam o Node com a cadeia de certificados confiáveis do sistema. Isso permite validar a conexão TLS com o Gemini em ambientes Windows que usam um certificado de rede instalado no sistema.

Para usar somente a cota gratuita, o projeto da chave precisa estar no nível gratuito, sem vínculo com uma conta de faturamento. O contador de tokens do site não é um bloqueio de cobrança. A pesquisa com Google Search fica desativada por padrão: questões sem gabarito são resolvidas em uma chamada JSON usando o material e o conhecimento do modelo, sem inventar fontes. `GEMINI_GOOGLE_SEARCH=true` habilita a pesquisa e pode exigir o plano pago. Não habilite essa opção em uma configuração exclusivamente gratuita. Ao atingir a cota, o site informa o bloqueio do provedor; não troca de projeto nem ativa faturamento.

A geração compartilha um prazo de até 105 segundos entre todas as chamadas ao modelo. Reservas de tokens estimados usam cotas persistentes por usuário (24 horas) e por projeto (mês); configure `AI_USER_DAILY_TOKEN_BUDGET` e `AI_MONTHLY_TOKEN_BUDGET`. Esses limites são conservadores e não representam cobrança real do provedor. Questões geradas exigem cinco alternativas únicas, gabarito válido e trecho de origem encontrado no material. Materiais grandes são amostrados em trechos distribuídos e recebem aviso de cobertura parcial. Isso verifica a existência do trecho, não garante que o raciocínio da IA esteja correto: o administrador precisa conferir os rascunhos no editor antes de publicar.

PDFs têm limite de 4 MB e 500 páginas; texto extraído tem limite de 400 mil caracteres. O arquivo original é armazenado em uma tabela separada (`material_files`, bytea) no PostgreSQL e servido por uma rota autenticada, com leitura e download para alunos aprovados. Listagens não carregam o binário. Materiais antigos podem receber um anexo em Materiais; editar o texto não altera o PDF. O limite de 4 MB mantém o envio abaixo do limite do host. O compose é para banco local, não um deploy completo.

O administrador principal pode conceder e revogar a função de assistente em Administração → Usuários cadastrados. Assistentes aprovados e desbloqueados podem adicionar e editar matérias, questões e materiais, anexar PDFs e gerar questões. Exclusões, aprovação de usuários, suporte administrativo, auditoria e permissões exigem o administrador principal, inclusive nas APIs. A migração `0003_assistant_and_pdf.sql` adiciona a função e a tabela de anexos; aplique-a antes de executar a nova versão.

O login oferece um botão para mostrar ou ocultar a senha. Em Minha conta, usuários podem ativar um autenticador TOTP e guardar códigos de recuperação exibidos uma vez. Cadastros novos e trocas de senha exigem no mínimo 6 caracteres; senhas antigas continuam válidas para entrada. Configure uma chave estável `MFA_ENCRYPTION_KEY` antes de habilitar o TOTP e preserve-a separadamente dos backups. Depois que o administrador principal ativar o próprio TOTP, `MFA_REQUIRE_ADMIN=true` pode exigir essa proteção para as funções administrativas. A migração `0004_quality_security.sql` adiciona os campos necessários.

## Qualidade e testes

### Recados e acompanhamento de usuários

Aplique `npm run db:migrate` antes de publicar esta versão: a migração `0005_user_management.sql` adiciona recados, leituras, cotas e acompanhamento sem apagar dados existentes. As quatro variáveis de cota constam em `.env.example`; os padrões estão descritos acima.

Em Administração, publique recados gerais ou individuais e arquive/reative os publicados. A seleção individual acompanha a página filtrada de usuários; busque por nome ou e-mail para encontrar o destinatário. Nas páginas internas, Recados e mensagens mostra os 50 avisos mais recentes e o total de conversas não lidas. Atualiza ao entrar, ao voltar à janela e a cada minuto enquanto visível.

Em Usuários cadastrados → Ver acompanhamento, consulte cadastro e contatos, último login, atividade recente, tempo ativo estimado, provas, acertos por matéria, revisões e últimas dez provas. O tempo começa a ser medido após a instalação, com aba visível e interação recente; não recupera o passado nem comprova atenção. O administrador pode iniciar uma conversa; o aluno responde em Falar com admin. As mensagens são internas, sem disparo automático de e-mail ou WhatsApp. Recados individuais e conversas são protegidos por destinatário; assistentes não recebem acesso administrativo.

A exportação da conta inclui os novos dados pessoais. A exclusão remove cotas individuais e leituras; `npm run db:cleanup` remove contadores de cota com mais de 30 dias. Os testes usam PostgreSQL embutido descartável (PGlite), aplicam todas as migrações e verificam destinatários, respostas, concorrência de cota e atividade sem acessar contas reais nem consumir APIs de IA.

### Comandos de verificação

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run security:check
```

Testes de integração usam um banco separado e um servidor de produção na porta 3100:

```powershell
docker compose -f docker-compose.test.yml -p aprova-quality up -d
npm run db:test:setup
npm run build
npm run test:e2e
npx playwright install chromium
npm run test:browser
npm run test:load
```

`db:test:setup` cria um banco novo chamado `aprova_test_<timestamp>`, preenche uma estrutura antiga e testa a atualização. Nunca utiliza o banco da aplicação. `.test-env.json` contém apenas configuração e credenciais descartáveis de teste, fica ignorado pelo Git e não deve ser publicado. O servidor de teste desativa Gemini e Groq e simula o envio do Resend, sem enviar e-mails ou consumir APIs externas. `test:browser` cria sua própria base isolada, pois a suíte de API altera as contas de teste. A medição de carga escreve `artifacts/load-report.json`; seus tempos locais não são uma promessa de capacidade em produção. Para inspecionar no navegador, use `npm run test:server` após o build.

O CI executa verificações estáticas, auditoria de dependências, testes unitários, migração de banco antigo, build, testes de APIs e fluxos reais no Chromium contra PostgreSQL isolado. `security:check` rejeita alertas altos novos e documenta a mitigação local da cadeia `braces` no ambiente de desenvolvimento até haver correção publicada.

## Operação, backup e restauração

`npm run doctor` verifica configuração sem exibir segredos, checksums e migrações esperadas, além das tabelas e colunas novas. Logs de requisições usam IDs de referência, status e latência; não incluem consultas, tokens nem dados pessoais. `/api/health` verifica conexão e esquema. Configure `MONITOR_URL` com o domínio HTTPS e execute `npm run ops:monitor` em um serviço externo de monitoramento. Ações administrativas ficam em `/app/admin`, na seção Auditoria.

Execute diariamente o backup seguido da limpeza. A rotina remove sessões e tokens expirados, limites vencidos e auditoria com mais de 90 dias. No Windows local, `powershell -File scripts/install-maintenance-task.ps1 -Container repete-postgres` registra a tarefa `Aprova-UNIVESP-Manutencao-Local` às 02:00 no fuso do Windows, sem substituir tarefa existente. Ela chama `scripts/maintenance.ps1`, que só limpa depois de criar o backup. Em hospedagem, configure agendamento e retenção equivalentes; cópias locais não substituem backups fora do computador.

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
