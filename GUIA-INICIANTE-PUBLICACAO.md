# Aprova UNIVESP — guia de publicação para iniciantes

Faça uma etapa por vez. Só avance quando chegar ao resultado indicado. Os nomes de alguns botões podem variar conforme o idioma do painel.

## Antes de começar: o que cada serviço faz

| Serviço | Para que serve |
| --- | --- |
| GitHub | Guarda o código do projeto e suas atualizações. |
| Neon | Guarda alunos, questões, matérias e histórico no banco de dados. |
| Vercel | Coloca o site na internet e executa as APIs. |
| Resend | Opcional: envia recuperação de senha. Cadastro não usa e-mail. |
| Gemini | Gera questões por IA; é opcional. |

“Deploy” significa publicar uma versão do site. “Variável de ambiente” é uma configuração preenchida fora do código, como a conexão do banco. “Migração” é o comando que cria ou atualiza as tabelas do banco.

Este roteiro começa com um banco Neon novo e vazio. Os dados do banco local não serão levados automaticamente. Se você precisa preservar os alunos e materiais locais, use a orientação de transferência no `DEPLOY-VERCEL-NEON.md` antes de criar as tabelas no Neon.

## Etapa 1 — conferir o computador

Seu projeto está nesta pasta:

```text
C:\projetos-sites-guit\univesp-study-landing-page
```

1. Abra o Explorador de Arquivos do Windows e entre nessa pasta.
2. Clique na barra de endereço, digite `powershell` e pressione Enter. Isso abre o terminal na pasta correta.
3. No terminal, execute um comando de cada vez:

```powershell
node -v
npm -v
```

O Node deve mostrar uma versão `v22...`. Se o comando não existir, instale Node.js 22 pelo site oficial https://nodejs.org e reabra o terminal. Não é preciso reinstalar se já funciona.

4. Para conferir o projeto:

```powershell
npm run lint
npm test
npm run build
```

**Deu certo quando:** os comandos terminam sem erro; o build apresenta a lista de páginas. Caso faltem dependências, execute `npm ci` e repita. Se aparecer erro de certificado no npm, resolva a confiança do certificado na máquina; não desligue a verificação SSL.

## Etapa 2 — enviar a versão atual ao GitHub

O projeto já está configurado localmente com este endereço remoto:

https://github.com/fabiosena1436/univesp-study-landing-page

Você não precisa criar outro repositório para seguir este roteiro.

1. Instale o GitHub Desktop pelo site oficial https://desktop.github.com, se ainda não tiver.
2. Abra o programa e entre na conta GitHub que tem acesso ao repositório.
3. Vá a **File → Add local repository**.
4. Em **Choose**, selecione a pasta do projeto indicada na etapa 1.
5. Clique em **Add repository**. Confira se a branch exibida é `main`.
6. Na aba **Changes**, confira os arquivos alterados. Arquivos como `package.json`, `package-lock.json`, documentos e código podem aparecer.
7. `.env.local`, `.env.neon`, `backups/` e `node_modules/` não devem aparecer. Eles já estão protegidos pelo `.gitignore`. Se aparecerem, pare antes do envio.
8. No campo **Summary**, escreva `Preparar Aprova UNIVESP para Vercel e Neon`.
9. Clique em **Commit to main**. Commit salva essa versão no seu computador.
10. Clique em **Push origin**. Push envia os commits ao GitHub. Se não houver mudanças para commit, confira se existe **Push origin** para enviar commits pendentes.
11. Abra o endereço do repositório no navegador e confira a atualização. Na aba **Actions**, procure o workflow **Quality**.

**Deu certo quando:** a versão nova aparece no GitHub e o workflow Quality termina com indicação verde. Se o Desktop indicar conflito ou exigir atualização da branch, não use force push: resolva a divergência primeiro.

Referência: [adicionar um repositório local ao GitHub Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop).

## Etapa 3 — criar o banco Neon

1. Acesse https://console.neon.tech e crie sua conta ou entre na existente.
2. Procure **New Project** ou **Create Project**.
3. Nome sugerido: `aprova-univesp`.
4. Escolha uma região disponível próxima da que pretende usar na Vercel. Anote a região; depois confira a região das funções na Vercel.
5. Crie o projeto. Pode manter os nomes padrão de banco e usuário: eles estarão incluídos na conexão copiada.
6. No projeto, clique em **Connect**.
7. Selecione a branch principal, o banco e o usuário do projeto.
8. Com **Connection pooling** ativado, copie a conexão. Ela começa com `postgresql://` e tem `-pooler` no endereço. Essa será `DATABASE_URL`.
9. Desative **Connection pooling** e copie a outra conexão, para a mesma branch, banco e usuário. Essa será `DATABASE_URL_UNPOOLED`.

**Deu certo quando:** você tem duas conexões do mesmo banco, uma com `-pooler` e outra sem. Ambas incluem usuário e senha: não cole essas conexões no chat, no código ou no GitHub. Copie somente a URL, sem `psql`, sem comandos e sem as aspas de um exemplo de terminal.

Referência: [Neon — conexões com pool e diretas](https://neon.com/docs/connect/connection-pooling).

## Etapa 4 — criar as tabelas no Neon sem alterar o banco local

Vamos usar um arquivo separado chamado `.env.neon`. O arquivo `.env.local`, com seu banco atual, permanece como está.

1. Abra a pasta do projeto no VS Code. Se não tiver, use https://code.visualstudio.com.
2. Na lista de arquivos, clique com o botão direito na pasta principal e escolha **New File**.
3. Nomeie exatamente `.env.neon`. Não acrescente `.txt`.
4. Cole este modelo e substitua os textos indicados pelas conexões reais:

```dotenv
DATABASE_URL="COLE_AQUI_A_URL_COM_POOL"
DATABASE_URL_UNPOOLED="COLE_AQUI_A_URL_DIRETA"
TZ=UTC
```

5. Salve com Ctrl+S. Mantenha cada URL inteira em uma única linha e mantenha os parâmetros que vieram do Neon.
6. Abra o PowerShell na pasta do projeto e execute:

```powershell
node --env-file=.env.neon scripts/migrate.mjs
```

Esse comando usa o arquivo do Neon especificamente. Não use `--adopt-legacy` para este banco novo.

7. Confira a conexão e o esquema:

```powershell
node --env-file=.env.neon scripts/doctor.mjs
```

**Deu certo quando:** a migração termina sem erro e o diagnóstico mostra `databaseConnected: true`, `migrationsRecorded: true` e `upgradedSchema: true`. As indicações de Resend nesse diagnóstico são locais; ainda vamos configurar o envio na Vercel.

Também é possível conferir as tabelas no painel de tabelas do Neon, como `users`, `subjects` e `questions`.

## Etapa 5 — preparar o envio de e-mails

Esta etapa é obrigatória para novos cadastros: configure o Resend para confirmação de e-mail e recuperação de senha. A entrega depende também do processamento pelo provedor do destinatário.

1. Entre em https://resend.com e crie sua conta.
2. Em **Domains**, adicione um domínio que você controla.
3. Copie os registros DNS pedidos pelo Resend para o painel onde esse domínio é administrado. Use os valores exatos mostrados pelo serviço.
4. Aguarde o status de domínio verificado.
5. Em **API Keys**, crie uma chave para envio de e-mails e guarde-a em local privado.
6. Defina um remetente desse domínio, por exemplo `Aprova UNIVESP <noreply@seudominio.com.br>`.

O exemplo acima precisa ser substituído pelo seu domínio real. O endereço `fabiosena1436@gmail.com` é o contato do serviço; ele não substitui a verificação de um domínio de envio. Você também não controla o domínio `vercel.app` para verificar no Resend. Sem configurar o envio, novos cadastros ficam indisponíveis.

Referência: [verificação de domínio no Resend](https://resend.com/docs/dashboard/domains/introduction).

## Etapa 6 — importar o projeto na Vercel

1. Acesse https://vercel.com e entre usando sua conta GitHub.
2. No painel, procure **Add New → Project**, ou abra https://vercel.com/new.
3. Se o repositório não aparecer, use a opção para configurar o acesso ao GitHub e autorize esse repositório.
4. Encontre `univesp-study-landing-page` e clique em **Import**.
5. Em nome do projeto, escolha `aprova-univesp`, se disponível. Se já estiver ocupado, escolha outro e anote o nome.
6. Confira **Framework Preset: Next.js**.
7. Deixe **Root Directory** na raiz do repositório. Não selecione `src`.
8. Em configurações de build, use **Install Command: `npm ci`** e **Build Command: `npm run build`**. Deixe o diretório de saída no padrão do Next.js.
9. Nas configurações do projeto, use **Node.js 22.x**. Se essa opção só aparecer depois da importação, ajuste-a antes de refazer o deploy.

Referência: [publicação pelo painel da Vercel](https://vercel.com/docs/getting-started-with-vercel).

## Etapa 7 — preencher as variáveis na Vercel

Na importação, abra **Environment Variables**. Para alterar depois, entre no projeto e use **Settings → Environment Variables**. Cada variável tem um campo de nome e outro de valor.

Preencha uma por vez. Nos campos do painel, cole o valor sem aspas externas:

| Nome | O que colocar no valor |
| --- | --- |
| `DATABASE_URL` | A conexão Neon com `-pooler`, copiada na etapa 3. |
| `APP_URL` | O endereço HTTPS estável do seu site, sem barra no final. |
| `RESEND_API_KEY` | Opcional: chave Resend para recuperação de senha. |
| `RESEND_FROM_EMAIL` | Opcional: remetente do seu domínio verificado. |
| `DB_POOL_MAX` | `3` |
| `TZ` | `UTC` |
| `GEMINI_API_KEY` | Sua chave Gemini, somente se quiser geração por IA. |

Exemplo de `APP_URL`, se esse for o endereço atribuído ao seu projeto:

```text
https://aprova-univesp.vercel.app
```

Use o endereço real que a Vercel atribuir. Se o nome estiver ocupado, pode ser diferente. O banco precisa dessa configuração na Vercel mesmo que a conexão já esteja em `.env.neon` no computador: são ambientes separados.

Selecione **Production** para as configurações do site público. Não use o banco de produção em **Preview**. Para previews, configure outro banco ou branch Neon e uma URL de teste própria; isso pode ser feito mais tarde.

`DATABASE_URL_UNPOOLED` não é necessária para o site funcionar: ela já está no arquivo privado usado para migrações. Não use `NEXT_PUBLIC_` no nome das chaves nem das conexões.

**Deu certo quando:** as variáveis foram salvas no projeto correto, para Production, sem expor seus valores publicamente.

Referência: [variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables).

## Etapa 8 — publicar e conferir o endereço

1. Clique em **Deploy** na importação.
2. Aguarde a publicação. Se falhar, abra os logs de build para identificar a mensagem.
3. Quando concluir, abra o projeto e confira o endereço estável em **Domains**. Ele pode terminar em `.vercel.app`.
4. Abra esse endereço no navegador. Não use o endereço temporário de uma versão específica para preencher `APP_URL`.
5. Se `APP_URL` não corresponder ao endereço estável, corrija em **Settings → Environment Variables**.
6. Depois de alterar variáveis, vá a **Deployments**, encontre a publicação mais recente, abra o menu e escolha **Redeploy**. Mudar a variável não atualiza automaticamente uma versão já publicada.
7. Em configurações de funções, confira Fluid Compute e a região próxima do Neon.
8. Abra o endereço do site acrescentando `/api/health` ao final.

**Deu certo quando:** a página inicial abre, a publicação está pronta e a rota de saúde responde sem erro de banco.

## Etapa 9 — criar sua conta e virar administrador

1. Abra seu site e clique em criar conta.
2. Para a conta administrativa, cadastre `26241463@aluno.univesp.br`. Para testar como aluno, cadastre `fabiosena1436@gmail.com`. Escolha senhas para cada conta.
3. Abra o e-mail de confirmação e clique no link; na página, clique em **Confirmar meu e-mail**. Depois entre com e-mail e senha. Aguarde alguns minutos e confira também **Outros** e **Lixo Eletrônico**. Se necessário, solicite outro link em `/confirmar-email`. Contas existentes mantêm seus dados e permissões; não precisam se cadastrar novamente.
4. No computador, mantenha `.env.neon` configurado e execute, para promover a conta institucional já cadastrada:

```powershell
node --env-file=.env.neon scripts/admin.mjs 26241463@aluno.univesp.br
```

5. Quando aparecer `Administrator promoted.`, saia do site e entre de novo.
6. Confira as opções administrativas. Crie uma matéria e publique questões para testar.

fabiosena1436@gmail.com foi autorizado como aluno, sem permissões administrativas. A conta institucional só recebe administração após executar o comando acima. O comando não cria a conta: cadastre-a primeiro.

**Deu certo quando:** você consegue acessar as funções administrativas, publicar conteúdo e realizar um simulado com o resultado no histórico.

## Etapa 10 — conferir o funcionamento e atualizar no futuro

Teste cadastro, confirmação de e-mail, reenvio, login, importação, simulado e histórico. Confirmação e recuperação dependem do Resend e do recebimento pelo provedor. Geração Gemini só funciona com a chave configurada e com acesso ao modelo na sua conta.

Em futuras alterações de código, use GitHub Desktop: confira Changes, faça Commit e depois Push origin. A integração GitHub/Vercel cria uma nova publicação a cada push na branch conectada. Se uma alteração incluir migrações, aplique-as no Neon pelo comando da etapa 4 antes de liberar a versão que precisa delas.

Backups e limpeza periódica ainda precisam de um agendamento externo; publicar o site não instala esse agendamento. Veja os comandos de operação no README.

## Se aparecer um problema

| Sintoma | O que conferir primeiro |
| --- | --- |
| `DATABASE_URL is required` | Variável DATABASE_URL salva para Production e novo deploy realizado. |
| Tabela inexistente / `relation does not exist` | Etapa 4 executada no mesmo banco usado pela Vercel. |
| Origem não permitida | APP_URL igual ao domínio aberto, com HTTPS; redeploy após corrigir. |
| Cadastro recusado | Use @aluno.univesp.br ou a exceção fabiosena1436@gmail.com; confira os campos e a senha. |
| E-mail não chega | Spam, endereço institucional digitado e logs de envio no Resend. |
| Conta não vira administrador | Conta institucional cadastrada e não bloqueada; comando usando o arquivo do Neon correto. |
| Importação de PDF falha por tamanho | Vercel limita o payload das funções a 4,5 MB; divida o arquivo ou importe o texto. |
| IA não gera questões | GEMINI_API_KEY, modelo disponível e cota da conta. |
| Site antigo após mudar variável | Execute Redeploy; confira que abriu o domínio estável. |

Referência: [limites das funções Vercel](https://vercel.com/docs/functions/limitations).

Para pedir ajuda, informe a etapa e a mensagem de erro. Não envie URLs de conexão, senhas, chaves de API ou o conteúdo dos arquivos `.env`.
