const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiError, handleError, str } = require('../../.test-build/lib/errors.js');

function loginHarness({ correct = true, blocked = false, outage = false } = {}) {
  const counts = { failures: 0, clears: 0, checks: 0, verified: 0 };
  const user = { id: 'user', name: 'Aluno', passwordHash: 'hash', isBlocked: false, emailVerifiedAt: new Date() };
  const code = ts.transpileModule(fs.readFileSync('src/app/api/auth/login/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const modules = {
    'drizzle-orm': { eq: () => null }, '@/db/schema': { users: {} },
    '@/db': { db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [user] }) }) }), update: () => ({ set: () => ({ where: async () => {} }) }) } },
    '@/lib/auth': { verifyPassword: async () => { counts.verified++; return correct; }, safeUser: u => u, createSession: async () => { if (outage) throw new ApiError(503, 'Serviço indisponível.'); } },
    '@/lib/errors': { ApiError, handleError, str }, '@/lib/constants': { EMAIL_RE: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    '@/lib/rateLimit': {
      rateLimit: async () => {},
      checkLoginFailures: async () => { counts.checks++; if (blocked) throw new ApiError(429, 'Tente novamente em 42 segundos.', 42); },
      recordLoginFailure: async () => { counts.failures++; }, clearLoginFailures: async () => { counts.clears++; },
    },
  };
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; }, Response, Buffer });
  return { counts, login: () => exports.POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'aluno@example.com', password: 'senha' }) })) };
}

test('repeated successful logins clear failures and never consume the password limit', async () => {
  const h = loginHarness();
  for (let i = 0; i < 12; i++) assert.equal((await h.login()).status, 200);
  assert.equal(h.counts.failures, 0); assert.equal(h.counts.clears, 12);
});
test('wrong passwords count as failures but system outages do not', async () => {
  const wrong = loginHarness({ correct: false });
  assert.equal((await wrong.login()).status, 401); assert.equal(wrong.counts.failures, 1); assert.equal(wrong.counts.clears, 0);
  const outage = loginHarness({ outage: true });
  assert.equal((await outage.login()).status, 503); assert.equal(outage.counts.failures, 0);
});
test('blocked attempts stop before password verification and disclose retry time', async () => {
  const h = loginHarness({ blocked: true });
  const response = await h.login();
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '42');
  assert.equal((await response.json()).retryAfter, 42); assert.equal(h.counts.verified, 0);
});
