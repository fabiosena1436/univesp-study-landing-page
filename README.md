# Repete

Aplicação Next.js para importar, organizar e revisar questões de estudo. O projeto usa PostgreSQL com Drizzle ORM.

## Requisitos

- Node.js 20 ou superior
- Docker Desktop (para iniciar o PostgreSQL local)

## Executar localmente

No PowerShell, dentro desta pasta:

```powershell
Copy-Item .env.example .env.local
docker compose up -d
npx drizzle-kit push
npm run dev
```

Abra `http://localhost:3000`.

O banco é criado com usuário `app`, senha `app`, banco `app_db` e porta local `55432`. A porta interna do PostgreSQL continua sendo `5432`, mas a porta `55432` evita conflitos com instalações locais.

## Verificações

```powershell
npm run typecheck
npm run lint
npm run build
```

`GEMINI_API_KEY` é opcional. Sem essa variável, a aplicação usa o gerador local de questões.
