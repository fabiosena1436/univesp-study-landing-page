const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiError, handleError, str } = require('../../.test-build/lib/errors.js');
const { EMAIL_RE, registrationEmailAllowed } = require('../../.test-build/lib/constants.js');
const { passwordError } = require('../../.test-build/lib/validation.js');

function load(path, modules) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  }, Response, Buffer, process: { env: {} } });
  return exports;
}

test('registration creates a pending session without issuing email confirmation', async () => {
  const created = [];
  const sessions = [];
  const modules = {
    'drizzle-orm': { eq: () => null, sql: () => null }, '@/db/schema': { users: {}, authorizedEmails: {} },
    '@/db': { db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
      insert: () => ({ values: data => { created.push(data); return { returning: async () => [{ id: 'new-user', ...data }] }; } }),
      execute: async () => {},
      transaction: async callback => callback(modules['@/db'].db),
    } },
    '@/lib/auth': { hashPassword: async () => 'hashed-password', createSession: async id => sessions.push(id), safeUser: ({ passwordHash, ...user }) => user },
    '@/lib/errors': { ApiError, handleError, str }, '@/lib/constants': { EMAIL_RE, registrationEmailAllowed },
    '@/lib/validation': { passwordError }, '@/lib/rateLimit': { rateLimit: async () => {} },
    '@/lib/access': require('../../.test-build/lib/access.js'),
    '@/lib/emailVerification': { issueVerification: async () => { throw new Error('Envio indisponível'); } },
  };
  const { POST } = load('src/app/api/auth/register/route.ts', modules);
  const response = await POST(new Request('http://localhost/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Aluno', email: ' NOVO@ALUNO.UNIVESP.BR ', course: 'Computação', whatsapp: '(11) 99999-1234', password: 'TestingOnly123!' }) }));
  assert.equal(response.status, 201);
  assert.deepEqual(sessions, ['new-user']);
  assert.equal(created[0].email, 'novo@aluno.univesp.br');
  assert.equal(created[0].passwordHash, 'hashed-password');
  const body = await response.json();
  assert.equal(body.user.id, 'new-user');
  assert.equal(body.user.passwordHash, undefined);
  assert.equal(body.user.accessStatus, 'pending');
  assert.equal(body.verificationSent, undefined);
});

test('pending sessions may view their account but cannot pass the study authorization gate', async () => {
  for (const scenario of ['pending', 'blocked', 'expired']) {
    const user = { id: 'user', name: 'Aluno', email: 'aluno@aluno.univesp.br', course: 'Computação', createdAt: new Date(), emailVerifiedAt: null, isBlocked: scenario === 'blocked' };
    const row = { user, expiresAt: new Date(Date.now() + (scenario === 'expired' ? -60000 : 60000)) };
    const modules = {
      crypto: require('node:crypto'), 'next/headers': { cookies: async () => ({ get: () => ({ value: 'session-token' }) }) },
      'drizzle-orm': { eq: () => null }, bcryptjs: {}, '@/db/schema': { users: {}, sessions: {}, admins: {} },
      '@/lib/errors': { ApiError }, './errors': { ApiError },
      './access': require('../../.test-build/lib/access.js'),
      '@/db': { db: {
        select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [row] }) }), where: () => ({ limit: async () => [] }) }) }),
        delete: () => ({ where: async () => {} }),
      } },
    };
    const { getSessionUser, requireUser } = load('src/lib/auth.ts', modules);
    const result = await getSessionUser();
    assert.equal(result?.id ?? null, scenario === 'pending' ? 'user' : null);
    await assert.rejects(requireUser(), error => error.status === (scenario === 'pending' ? 403 : 401));
  }
});

test('resending confirmation reports provider failures and skips already verified accounts', async () => {
  let sent = 0;
  let confirmed = false;
  const { POST } = load('src/app/api/auth/resend-verification/route.ts', {
    '@/lib/auth': { requireAccount: async () => ({ id: 'user', emailVerifiedAt: confirmed ? new Date() : null }) },
    '@/lib/emailVerification': { issueVerification: async () => { sent++; throw new Error('Provider rejected'); } },
    '@/lib/errors': { ApiError, handleError }, '@/lib/rateLimit': { rateLimit: async () => {} },
  });
  assert.equal((await POST()).status, 503); assert.equal(sent, 1);
  confirmed = true;
  assert.equal((await POST()).status, 200); assert.equal(sent, 1);
});

test('password recovery still stores a hashed token and sends the reset link', async () => {
  const saved = [];
  const sent = [];
  const modules = {
    'drizzle-orm': { eq: () => null }, '@/db/schema': { users: {}, passwordResetTokens: {} },
    '@/db': { db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 'user', email: 'aluno@aluno.univesp.br' }] }) }) }),
      insert: () => ({ values: async data => saved.push(data) }),
    } },
    '@/lib/passwordReset': require('../../.test-build/lib/passwordReset.js'),
    '@/lib/email': { sendPasswordResetEmail: async (email, url) => sent.push({ email, url }) },
    '@/lib/accountEmail': { appUrl: () => 'https://example.test' },
    '@/lib/rateLimit': { rateLimit: async () => {} }, '@/lib/errors': { handleError, str },
  };
  const { POST } = load('src/app/api/auth/forgot-password/route.ts', modules);
  const response = await POST(new Request('http://localhost/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'aluno@aluno.univesp.br' }) }));
  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'aluno@aluno.univesp.br');
  const link = new URL(sent[0].url);
  assert.equal(link.pathname, '/redefinir-senha');
  const token = link.searchParams.get('token');
  assert.equal(saved[0].userId, 'user');
  assert.notEqual(saved[0].tokenHash, token);
  assert.equal(saved[0].tokenHash, require('node:crypto').createHash('sha256').update(token).digest('hex'));
  assert.ok(saved[0].expiresAt.getTime() > Date.now());
});
