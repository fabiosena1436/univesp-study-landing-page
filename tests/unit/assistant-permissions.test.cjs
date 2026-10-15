const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiError, handleError, isUuid } = require('../../.test-build/lib/errors.js');
const access = require('../../.test-build/lib/access.js');

function load(path, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Response, Buffer, process: { env: {} }, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return exports;
}

test('assistants must have approved access and cannot pass the principal administrator gate', async () => {
  // Session query followed by the principal-admin lookup, using the actual auth gates.
  for (const status of ['approved', 'pending', 'rejected']) {
    let calls = 0;
    const account = { id: 'assistant', name: 'Assistente', email: 'a@example.com', createdAt: new Date(), isAssistant: true, accessStatus: status, emailVerifiedAt: null };
    const query = { innerJoin: () => query, where: () => query, limit: async () => calls % 2 === 1 ? [{ user: account, expiresAt: new Date(Date.now() + 60000) }] : [] };
    const auth = load('src/lib/auth.ts', {
      react: { cache: fn => fn }, crypto: require('node:crypto'), bcryptjs: {}, 'next/headers': { cookies: async () => ({ get: () => ({ value: 'session' }) }) },
      'drizzle-orm': { eq: () => null }, '@/db/schema': { users: {}, sessions: {}, admins: {} },
      '@/db': { db: { select: () => { calls++; return { from: () => query }; } } }, './errors': { ApiError }, './access': access,
    });
    if (status === 'approved') {
      assert.equal((await auth.requireContentManager()).isAssistant, true);
      account.isAssistant = false;
      await assert.rejects(auth.requireContentManager(), e => e.status === 403);
      account.isAssistant = true;
    } else await assert.rejects(auth.requireContentManager(), e => e.status === 403);
    await assert.rejects(auth.requireAdmin(), e => e.status === 403);
    account.isBlocked = true;
    await assert.rejects(auth.requireContentManager(), e => e.status === 401);
  }
});

test('assistant cannot delete content or manage accounts, approvals, audit, or AI usage via direct API calls', async () => {
  const routes = [
    ['subjects/[id]', 'DELETE'], ['questions/[id]', 'DELETE'], ['materials/[id]', 'DELETE'],
    ['admin/users', 'PATCH'], ['admin/users', 'DELETE'], ['admin/access', 'PATCH'],
    ['admin/authorized-emails', 'POST'], ['admin/audit', 'GET'], ['admin/ai-usage', 'GET'],
  ];
  for (const [path, method] of routes) {
    let dbTouched = false;
    const modules = {
      'drizzle-orm': {}, '@/db/schema': {}, '@/db': { db: new Proxy({}, { get: () => { dbTouched = true; throw new Error('Database accessed before authorization'); } }) },
      '@/lib/auth': { requireAdmin: async () => { throw new ApiError(403, 'Restrito'); }, requireContentManager: async () => ({ id: 'assistant', isAssistant: true }) },
      '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler }, '@/lib/mfa': { validateMfa: () => null }, '@/lib/clientRateLimit': { limitClient: async () => {} }, '@/lib/aiOperation': { withAiOperation: (_id, _signal, work) => work() }, '@/lib/pdfValidation': {}, '@/lib/errors': { ApiError, handleError, isUuid }, '@/lib/audit': {}, '@/lib/validation': {}, '@/lib/fingerprint': {}, '@/lib/options': {}, '@/lib/access': access, '@/lib/aiUsageStore': {}, '@/lib/rateLimit': {},
    };
    const route = load(`src/app/api/${path}/route.ts`, modules);
    const res = await route[method](null, { params: Promise.resolve({ id: '8aad91a1-5678-4123-9123-123456789abc' }) });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal(dbTouched, false);
  }
});

test('principal can grant and revoke assistants, but must approve/unblock accounts first and cannot demote principal admins', async () => {
  for (const [status, blocked, principal, assistant, expected] of [
    ['approved', false, false, true, 200], ['approved', false, false, false, 200],
    ['pending', false, false, true, 400], ['rejected', false, false, true, 400],
    ['approved', true, false, true, 400], ['approved', false, true, true, 403],
  ]) {
    const schema = { users: {}, admins: {} };
    const account = { id: '8aad91a1-5678-4123-9123-123456789abc', accessStatus: status, isBlocked: blocked, isAssistant: !assistant };
    const changes = [];
    const events = [];
    const tx = {
      select: () => ({ from: table => ({ where: () => {
        const result = Promise.resolve(table === schema.admins ? (principal ? [{}] : []) : [account]);
        result.for = () => result;
        return { limit: () => result };
      } }) }),
      update: () => ({ set: values => ({ where: async () => { changes.push(values); } }) }),
    };
    const route = load('src/app/api/admin/users/route.ts', {
      'drizzle-orm': { eq: () => null }, '@/db/schema': schema, '@/db': { db: { transaction: callback => callback(tx) } },
      '@/lib/auth': { requireAdmin: async () => ({ id: 'principal' }) },
      '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler }, '@/lib/mfa': { validateMfa: () => null }, '@/lib/clientRateLimit': { limitClient: async () => {} }, '@/lib/aiOperation': { withAiOperation: (_id, _signal, work) => work() }, '@/lib/pdfValidation': {}, '@/lib/errors': { ApiError, handleError }, '@/lib/validation': require('../../.test-build/lib/validation.js'),
      '@/lib/audit': { audit: async (...args) => events.push(args) },
    });
    const res = await route.PATCH({ json: async () => ({ id: account.id, assistant }) });
    assert.equal(res.status, expected);
    if (expected === 200) {
      assert.equal(changes.length, 1);
      assert.equal(changes[0].isAssistant, assistant);
      assert.equal(events[0][1], assistant ? 'user.assistant.grant' : 'user.assistant.revoke');
    } else { assert.equal(changes.length, 0); assert.equal(events.length, 0); }
  }
});
