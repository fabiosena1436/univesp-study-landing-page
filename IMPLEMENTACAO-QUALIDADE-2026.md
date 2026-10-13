# Evolução técnica do Aprova UNIVESP

Atualizado em 13 de outubro de 2026. Este documento registra a implementação posterior à [auditoria inicial](AUDITORIA-ARQUITETURA-2026.md). Os números daquela auditoria descrevem a versão anterior e são mantidos como referência histórica.

## Resultado entregue

| Área | Implementação e evidência |
| --- | --- |
| Cadastro e acesso | Cadastro restrito a `@aluno.univesp.br`, sem etapa de confirmação de e-mail. A aprovação administrativa continua necessária, salvo pré-autorização. Contas pendentes podem exportar dados, mudar senha e excluir a própria conta em `/conta`, mas não acessar estudos. |
| Login | Botão acessível para mostrar ou ocultar a senha. Senhas novas exigem 15 caracteres; senhas antigas continuam aceitas para autenticação. TOTP opcional com segredo cifrado e códigos de recuperação de uso único; `MFA_REQUIRE_ADMIN` permite exigir a proteção dos administradores após a ativação da conta principal. |
| Permissões | O administrador pode conceder e revogar a função de assistente. Assistentes podem adicionar e gerenciar matérias, questões, provas e materiais; não podem aprovar contas, conceder permissões ou excluir conteúdo. As APIs impõem as mesmas regras da interface. |
| Materiais | PDFs originais e conteúdo em texto aparecem separados para os alunos. O seletor de arquivo está identificado como “Buscar PDF”. Criação e anexação aceitam PDFs válidos até 4 MiB através do proxy; arquivos maiores recebem rejeição coerente. O arquivo fica separado dos metadados e exige sessão autorizada para leitura. |
| Painel | Total de provas calculado no PostgreSQL, inclusive acima de 100. Histórico recente continua limitado para o gráfico. Dados iniciais chegam do servidor. |
| IA | Prazo compartilhado entre etapas, cancelamento propagado, atribuição de chamadas ao usuário/operação e reservas de tokens estimados com limites persistentes por usuário e projeto. O bloqueio de orçamento retorna HTTP 429. A estimativa protege o uso, mas não é uma medição de faturamento. |
| Segurança e interface | Limites por origem confiável nas rotas públicas, IDs de requisição e latência nos logs, contraste corrigido, rótulos de formulários associados, controles sem botões aninhados e suporte a movimento reduzido. |
| Organização | Fluxos de materiais e provas extraídos para hooks de funcionalidades; painel com repositório de leitura próprio e rota autorizada. O projeto permanece um monólito modular. |
| Operação | `doctor` e `/api/health` verificam esquema, além da conexão. Há verificação de segurança, testes reais no navegador, medição local de carga, backup, restauração e manutenção diária local às 02:00 no fuso de Brasília. |

## Verificações executadas

- `npm run lint`, `npm run typecheck` e `npm run build`: aprovados com Next.js 16.4.0.
- `npm test`: 65 testes unitários aprovados.
- `npm run test:e2e`: 24 testes de integração aprovados em PostgreSQL isolado. Cobrem migração legada, acesso, aprovação, assistente, PDF, MFA, limite de login e outros fluxos de API.
- `npm run test:browser`: 6 fluxos aprovados no Chromium, incluindo botão de senha, cadastro pendente, aprovação e assistente, PDF de 3 MiB, filtro de materiais, prova, painel com mais de 100 tentativas e verificações WCAG automatizadas em tela móvel.
- `npm run security:check`: nenhum alerta alto ou crítico sem mitigação conhecida. `npm audit --omit=dev` não apontou vulnerabilidades de produção. Cinco entradas altas da mesma cadeia de `braces` permanecem reportadas em ferramentas de desenvolvimento; o `postinstall` aplica e verifica um limite local de profundidade até uma correção upstream ser publicada.
- `npm run doctor`: banco principal conectado, todas as migrações registradas, checksums e esquema atualizados, armazenamento de PDF e chave de MFA configurados.
- Backup local gerado em `backups/` antes da limpeza. A restauração do backup atualizado em um banco isolado preservou registros, progresso e snapshots. A tarefa do Windows `Aprova-UNIVESP-Manutencao-Local` está pronta para executar diariamente às 02:00 no horário de Brasília, sob a conta local Fabio com logon interativo. Também foi disparada manualmente pelo Agendador: resultado 0, novo backup criado e limpeza concluída.
- Medição local com 2.000 questões e uma amostra de PDF de 3 MiB: 60 requisições ao painel tiveram p95 de 121 ms; 60 ao catálogo, 30 ms; 15 de seleção de prova, 39 ms; nenhuma falha. O `ORDER BY random()` medido levou aproximadamente 0,6 ms nessa amostra. Detalhes e plano SQL: `artifacts/load-report.json` (ignorado pelo Git). Esses valores não estimam o limite de usuários da produção.

## Dependências externas para operar em produção

O ambiente local não tem `RESEND_API_KEY` nem remetente verificado; recuperação de senha foi testada com envio simulado, sem disparar mensagem real. A hospedagem ainda precisa receber a chave estável de MFA e as variáveis de ambiente documentadas, além de um destino externo para cópias de segurança e um serviço que consulte `/api/health` e alerte em caso de falha. A tarefa do Windows é uma rotina local e depende da sessão interativa e do Docker disponível. Nenhuma implantação de produção, configuração de DNS/remetente ou teste de e-mail real foi realizado nesta etapa.

O PostgreSQL local foi encontrado publicado em todas as interfaces pelo contêiner já existente, apesar de `docker-compose.yml` configurar apenas loopback. Uma recriação controlada do contêiner local, após conferir volumes e janela de manutenção, deve alinhar a porta ativa com a configuração. O banco isolado de testes usa a porta 55439 e não deve receber tráfego externo.

O código valida formato do endereço institucional, não a titularidade da caixa de e-mail. A aprovação manual deve conferir a identidade quando isso for necessário. PDFs em `bytea` tiveram desempenho adequado na amostra local; migrar para armazenamento de objetos, paginação por cursor ou processamento assíncrono dependerá de medidas em escala maior.
