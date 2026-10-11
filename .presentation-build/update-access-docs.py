from pathlib import Path
replacements = {
 'src/app/termos/page.tsx': [
  ('O cadastro aceita e-mails @aluno.univesp.br e endereços especificamente autorizados pelo responsável. O acesso é liberado após o cadastro, sem confirmação de e-mail. O endereço é usado para entrar e recuperar a senha.', 'O cadastro cria uma conta com acesso ao conteúdo condicionado à confirmação do e-mail e à autorização do administrador. Endereços da lista de e-mails pré-autorizados dispensam a aprovação manual, mas ainda precisam de confirmação. Use preferencialmente seu e-mail @aluno.univesp.br. O WhatsApp com DDD permite ao administrador avisar manualmente sobre a autorização. O e-mail é usado para confirmação, entrada e recuperação de senha.'),
  ('Atualizados em 6 de outubro de 2026.', 'Atualizados em 11 de outubro de 2026.')],
 'src/app/privacidade/page.tsx': [
  ('Guardamos nome, e-mail da conta, curso,', 'Guardamos nome, e-mail da conta, curso, WhatsApp informado, situação da autorização, confirmação do e-mail,'),
  ('Esses dados permitem identificar sua conta, oferecer estudos e responder ao suporte.', 'Esses dados permitem identificar sua conta, avaliar e avisar sobre a autorização de acesso, oferecer estudos e responder ao suporte. O administrador pode abrir uma conversa no WhatsApp e enviar o aviso manualmente.'),
  ('compartilhado com alunos autenticados.', 'compartilhado com alunos autenticados e autorizados.'),
  ('O envio de e-mail é usado apenas para recuperação de senha,', 'O envio de e-mail é usado para confirmação do endereço e recuperação de senha,'),
  ('links de recuperação em 30 minutos.', 'links de recuperação em 30 minutos e links de confirmação em 24 horas.'),
  ('Atualizada em 6 de outubro de 2026.', 'Atualizada em 11 de outubro de 2026.')],
 'DEPLOY-VERCEL-NEON.md': [
  ('cadastro com acesso imediato, sem confirmação de e-mail, login,', 'cadastro com confirmação de e-mail e aprovação administrativa, lista de e-mails pré-autorizados, login,'),
  ('Teste a entrega de recuperação de senha', 'Teste a entrega da confirmação de e-mail e da recuperação de senha')],
 'GUIA-INICIANTE-PUBLICACAO.md': [
  ('Configure o Resend para recuperação de senha. Novos cadastros têm acesso imediato e não dependem do envio de e-mail.', 'Configure o Resend para confirmação de e-mail e recuperação de senha. Novos cadastros precisam confirmar o endereço e receber autorização do administrador.'),
  ('Após o cadastro, confira o acesso imediato à área de estudos. Contas existentes, inclusive com confirmação pendente, podem entrar com e-mail e senha e mantêm seus dados e permissões.', 'Após o cadastro, confira a tela de espera, a confirmação do e-mail e a aprovação administrativa. A lista de e-mails pré-autorizados dispensa somente a aprovação manual. A migração preserva o acesso das contas existentes.'),
  ('Teste cadastro com acesso imediato, login, recuperação de senha, importação, simulado e histórico. Apenas a recuperação de senha depende do Resend e do recebimento pelo provedor.', 'Teste cadastro pendente, confirmação, lista de e-mails pré-autorizados, aprovação, recusa, bloqueio, login, recuperação de senha, importação, simulado e histórico. Confirmação e recuperação de senha dependem do Resend e do recebimento pelo provedor.')],
 'src/app/page.tsx': [('Crie sua conta e escolha uma das matérias publicadas pelos administradores.', 'Crie sua conta, confirme seu e-mail e receba autorização para acessar as matérias publicadas.')],
 'src/components/AuthShell.tsx': [('Acesso gratuito com cadastro e senha', 'Acesso gratuito após confirmação e autorização')]
}
for name, pairs in replacements.items():
 path = Path(name)
 text = path.read_text(encoding='utf-8')
 for old, new in pairs:
  if old not in text: raise ValueError(f'Texto esperado não encontrado em {name}: {old}')
  text = text.replace(old,new)
 path.write_text(text,encoding='utf-8')
