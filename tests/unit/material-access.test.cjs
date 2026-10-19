const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiError, handleError, isUuid } = require('../../.test-build/lib/errors.js');

const id = '8aad91a1-5678-4123-9123-123456789abc';
const material = { id, subjectId: 'subject', title: 'Aula de matemática', filename: 'aula.pdf', pageCount: 3, charCount: 500, content: 'Conteúdo da aula', archivedAt: null, createdAt: new Date(), userId: 'admin-private' };

function loadRoute(path, { signedIn = true, materialArchived = false, subjectArchived = false } = {}) {
  let dbCalls = 0;
  const row = { material: { ...material, archivedAt: materialArchived ? new Date() : null }, subject: { archivedAt: subjectArchived ? new Date() : null } };
  const column = (table, key) => (r) => r[table][key];
  const modules = {
    'drizzle-orm': { sql: () => false,
      eq: (col, value) => (r) => col(r) === value,
      isNull: (col) => (r) => col(r) === null,
      and: (...checks) => (r) => checks.every((check) => check(r)),
    },
    '@/db/schema': { materialFiles: {}, materials: { id: column('material', 'id'), subjectId: column('material', 'subjectId'), archivedAt: column('material', 'archivedAt') }, subjects: { id: () => 'subject', archivedAt: column('subject', 'archivedAt') }, questions: {} },
    '@/db': { db: { select: () => {
      dbCalls++;
      return { from: () => ({ innerJoin: () => ({ where: (predicate) => ({ limit: async () => predicate(row) ? [row] : [] }) }) }) };
    } } },
    '@/lib/auth': {
      requireUser: async () => { if (!signedIn) throw new ApiError(401, 'Entre para continuar.'); return { id: 'student', isAdmin: false }; },
      requireContentManager: async () => { throw new ApiError(signedIn ? 403 : 401, "Restrito"); },
      requireAdmin: async () => { throw new ApiError(signedIn ? 403 : 401, 'Acesso restrito ao administrador.'); },
    },
    '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler }, '@/lib/mfa': { validateMfa: () => null }, '@/lib/clientRateLimit': { limitClient: async () => {} }, '@/lib/aiOperation': { withAiOperation: (_id, _signal, work) => work() }, '@/lib/pdfValidation': {}, '@/lib/errors': { ApiError, handleError, isUuid },
    '@/lib/contentNotice': {}, '@/lib/audit': {}, '@/lib/validation': {}, '@/lib/pdf': {}, '@/lib/rateLimit': {}, '@/lib/ai': {}, '@/lib/options': {},
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (!(name in modules)) throw new Error(`Unexpected dependency: ${name}`);
    return modules[name];
  }, Response });
  return { route: exports, dbCalls: () => dbCalls };
}

test('students can read shared material content without receiving administrator information', async () => {
  const { route } = loadRoute('src/app/api/materials/[id]/route.ts');
  const response = await route.GET(null, { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.content, material.content);
  assert.equal(body.filename, 'aula.pdf');
  assert.equal(body.userId, undefined);
});

test('material reading rejects visitors, archived materials, archived subjects and invalid IDs', async () => {
  for (const [options, requestedId, status] of [
    [{ signedIn: false }, id, 401], [{ materialArchived: true }, id, 404],
    [{ subjectArchived: true }, id, 404], [{}, 'invalid-id', 404],
  ]) {
    const { route } = loadRoute('src/app/api/materials/[id]/route.ts', options);
    const response = await route.GET(null, { params: Promise.resolve({ id: requestedId }) });
    assert.equal(response.status, status);
  }
});

test('students cannot upload, edit, delete or generate questions even when calling APIs directly', async () => {
  for (const [path, method] of [
    ['src/app/api/materials/route.ts', 'POST'],
    ['src/app/api/materials/[id]/route.ts', 'PATCH'],
    ['src/app/api/materials/[id]/route.ts', 'DELETE'],
    ['src/app/api/materials/[id]/generate/route.ts', 'POST'],
  ]) {
    const { route, dbCalls } = loadRoute(path);
    const response = await route[method](null, { params: Promise.resolve({ id }) });
    assert.equal(response.status, 403, `${method} ${path}`);
    assert.equal(dbCalls(), 0, 'Rejected requests must not access material data or start generation');
  }
});
