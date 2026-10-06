# Recuperação de senha e diagnóstico de entrega

O cadastro libera acesso imediato, sem confirmação de e-mail. Contas pendentes podem entrar com sua senha. Não é necessário executar migrações ou apagar contas. O envio de e-mail permanece apenas para recuperação de senha. Links antigos de confirmação redirecionam para o login.

## Teste após publicar

1. Abra `/recuperar-senha`, informe o e-mail da conta e solicite um link apenas uma vez.
2. Na Vercel, filtre Logs por `email.send`. `email.send.accepted` contém o `providerId` para localizar a mensagem no Resend; significa aceitação pelo serviço de envio, não entrega na caixa de entrada.
3. Se aparecer `email.send.failed`, confira `reason` e `status`. Os motivos incluem configuração ausente, rejeição do provedor e falha de rede/timeout. Não são registrados links, senhas, chaves nem o endereço completo do destinatário.
4. No Resend, confira destinatário, assunto, horário e evento de entrega. `Delivered` significa aceitação pelo servidor de destino. Confira a resposta SMTP.
5. Aguarde alguns minutos; no Outlook, procure em todas as pastas por `Aprova UNIVESP`, incluindo Outros e Lixo Eletrônico. Se não houver mensagem, consulte a quarentena em `https://security.microsoft.com/quarantine`.
6. Abra o link de recuperação e defina a nova senha. O link expira em 30 minutos e só pode ser usado uma vez; a redefinição invalida outros links e sessões da conta.

Se a mensagem foi aceita pelo servidor institucional, mas não está nas pastas ou na quarentena visível ao aluno, o suporte da universidade precisa consultar o rastreamento interno. Informe remetente, destinatário, assunto, horário e Message-ID da resposta SMTP; não compartilhe o link de recuperação.

O aviso de remetente externo apenas identifica que a mensagem veio de fora da universidade. Não indica bloqueio. O atraso observado na recuperação institucional não comprova a causa dos envios antigos de cadastro.

Em 03/10/2026, o teste de confirmação foi aceito pelo servidor institucional às 08:30 e apareceu no Outlook com horário 08:33. O teste anterior de recuperação teve intervalo de aproximadamente 5 minutos. Esses dois testes não estabelecem um prazo para outros usuários.

Consulta DNS em 03/10/2026: SPF em `send.portifoliofabiosena.com.br` e DKIM em `resend._domainkey.portifoliofabiosena.com.br` publicados; nenhum TXT encontrado em `_dmarc.portifoliofabiosena.com.br`. Próximo ajuste no provedor DNS: adicionar TXT com nome `_dmarc` e valor `v=DMARC1; p=none`. Essa política inicial permite monitoramento sem rejeitar mensagens; relatórios exigem configurar um endereço apropriado em `rua`. Verifique todos os serviços que enviam pelo domínio antes de adotar uma política de rejeição. DMARC não garante entrega imediata e sua ausência não comprova a causa do atraso observado.

Se o atraso persistir, pedir ao suporte da UNIVESP rastreamento dos Message-IDs. Uma troca de provedor ou o uso de código numérico também depende da entrega do e-mail e não elimina necessariamente a espera.

## Validação local

`npm run db:test:setup`, `npm run build` e `npm run test:e2e` exercitam cadastro com acesso imediato, login de contas pendentes, permissões e recuperação de senha com expiração e uso único. O servidor de testes utiliza uma chave fictícia e intercepta o Resend; nenhum e-mail real é enviado. Nunca execute o servidor de testes como servidor de produção.
