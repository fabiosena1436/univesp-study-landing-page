# Publicar Aprova UNIVESP: GitHub → Neon → Vercel

## 1. GitHub

Envie o código, `package-lock.json`, `migrations/` e `.github/workflows/ci.yml`. Não envie `.env.local`, `.test-env.json`, `backups/`, `artifacts/`, `node_modules/` ou `.vercel/`; essas pastas estão ignoradas. Confira os arquivos preparados antes do commit. O workflow Quality valida o código usando um banco de teste, sem acessar o Neon de produção.

## 2. Neon

Crie um projeto PostgreSQL no Neon ou conecte a integração Neon pelo Marketplace da Vercel. Escolha uma região próxima da região das funções. Copie duas URLs no painel Connect, para a mesma branch, banco e usuário:

- `DATABASE_URL`: conexão com pool; hostname contém `-pooler`.
- `DATABASE_URL_UNPOOLED`: conexão direta; usada pelas migrações e backups.

Mantenha os parâmetros TLS fornecidos pelo Neon. Não desative a validação de certificados. O projeto usa o driver PostgreSQL `pg`, compatível com o Neon e com as transações existentes.

Para um banco Neon novo, defina as duas URLs em um ambiente local privado e execute:

```powershell
npm run db:migrate
npm run doctor
```

Não use `--adopt-legacy` em banco vazio. O comando de migração recusa uma URL Neon com pool porque usa um bloqueio de sessão. Não adicione migrações ao Build Command: previews e builds concorrentes não devem alterar o banco de produção.

Se quiser levar os dados locais, restaure um backup atualizado em um banco Neon vazio pela conexão direta usando `pg_restore --exit-on-error --no-owner --no-acl`, com credenciais em variáveis `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` e `PGSSLMODE`, sem colocá-las na linha de comando. Depois rode `db:migrate` e `doctor`. O backup atualizado já contém os registros de migração; não inicialize o banco vazio antes de restaurá-lo. O verificador local de backup é restrito ao contêiner de testes e não transfere dados ao Neon.

Confirme que o fuso do banco é UTC com `SHOW timezone` no SQL Editor. Se necessário, configure o padrão da role da aplicação usando `ALTER ROLE <role> SET timezone TO 'UTC'` pela conexão direta. Para impor timeout no servidor com pool, configure também `ALTER ROLE <role> SET statement_timeout TO '15s'`. Use o nome real da role. A aplicação utiliza timeout no cliente e evita parâmetros de sessão no endpoint com pool.

## 3. Vercel

Importe o repositório GitHub como projeto Next.js. Use a raiz do repositório, Node.js 22.x, Install Command `npm ci` e Build Command `npm run build`. Ative Fluid Compute e escolha uma região próxima do Neon nas configurações das funções.

Configure estas variáveis no ambiente Production:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL Neon com pool e TLS |
| `APP_URL` | URL HTTPS estável do projeto, por exemplo `https://aprova-univesp.vercel.app` |
| `RESEND_API_KEY` | Obrigatória: chave privada do Resend para confirmação e recuperação |
| `RESEND_FROM_EMAIL` | Obrigatório: remetente autorizado no Resend |
| `GEMINI_API_KEY` | Chave privada do Gemini, se usar geração |
| `GEMINI_MODELS` | Modelo disponível na sua conta; padrão do código `gemini-2.5-flash` |
| `DB_POOL_MAX` | `3` como ponto inicial; ajustar após observar carga |
| `TZ` | `UTC` |

`DATABASE_URL_UNPOOLED` fica no ambiente seguro usado para migrações/backups; o runtime não precisa dela. Se a integração a adicionar na Vercel, não a exponha ao navegador. Nenhuma chave ou URL de banco deve ter prefixo `NEXT_PUBLIC_`. Alterações nas variáveis exigem novo deploy.

Use uma branch Neon separada para Preview. Configure `DATABASE_URL` de Preview para essa branch e aplique as migrações nela. Configure também `APP_URL` com a URL estável do ambiente de teste; a aplicação valida a origem das operações contra essa URL. URLs aleatórias de deploy não devem compartilhar o banco nem os e-mails de produção.

## 4. Limites do fluxo atual

As funções Vercel têm limite de payload de 4,5 MB. PDFs maiores devem ser divididos ou ter o texto extraído antes da importação; o limite local de 20 MB não amplia a capacidade da plataforma. A importação por texto funciona sem armazenamento de arquivos. Para PDFs maiores no futuro, implemente upload direto para armazenamento privado e processamento separado.

A geração de IA tem prazo total de 95 segundos; sua rota solicita `maxDuration=120`. Confirme que o plano e a configuração da Vercel permitem esse prazo. Não habilite o runtime Edge: o driver `pg` e o extrator de PDF usam Node.js.

Backups não devem ser gravados no disco temporário das funções. Execute `db:backup` e `db:cleanup` por um agendador externo autorizado, com acesso privado ao Neon. Mantenha cópias fora da máquina, teste restauração e confira a retenção disponível no seu plano Neon.

## 5. Conferência após publicar

Verifique `/api/health`, cadastro com confirmação por e-mail, login, publicação administrativa, simulado e histórico. Teste a entrega de recuperação de senha e uma geração Gemini. Promova a conta institucional já cadastrada usando `npm run db:admin -- 26241463@aluno.univesp.br`, com o ambiente apontando explicitamente para o banco desejado.

Confira os logs da Vercel e a utilização de conexões no Neon. O sucesso do build não confirma que as migrações ou o envio de e-mail estejam configurados.

Na auditoria desta preparação, o PostCSS foi atualizado para corrigir o alerta de alta severidade. Restam quatro alertas moderados na cadeia de desenvolvimento `drizzle-kit` → `@esbuild-kit` → `esbuild`, relacionados ao servidor de desenvolvimento do esbuild. O app não utiliza esse servidor, e as migrações aplicadas usam o script próprio com `pg`. Não execute `npm audit fix --force`: a sugestão atual faz downgrade do Drizzle Kit. Reavalie essa ferramenta quando houver atualização compatível corrigida.

Referências oficiais: [Neon: conexões com pool e diretas](https://neon.com/docs/connect/connection-pooling), [Vercel: gerenciamento de conexões](https://vercel.com/kb/guide/connection-pooling-with-functions), [Vercel: limites de funções](https://vercel.com/docs/functions/limitations).
