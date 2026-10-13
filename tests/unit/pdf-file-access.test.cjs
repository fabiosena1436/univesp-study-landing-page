const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { ApiError, handleError, isUuid } = require('../../.test-build/lib/errors.js');
const id = '8aad91a1-5678-4123-9123-123456789abc';

function load({ approved = true, manager = false, archivedMaterial = false, archivedSubject = false, missing = false } = {}) {
  const row = { material: { id, archivedAt: archivedMaterial ? new Date() : null }, subject: { archivedAt: archivedSubject ? new Date() : null }, data: Buffer.from('%PDF-1.4\noriginal-data'), filename: 'Aula "teste".pdf' };
  let reads = 0;
  const column = (table, key) => value => value[table][key];
  const db = { select: () => {
    reads++;
    const query = { from: () => query, innerJoin: () => query, where: predicate => ({ limit: async () => !missing && predicate(row) ? [row] : [] }) };
    return query;
  } };
  const modules = {
    'drizzle-orm': { eq: (col, value) => row => col(row) === value, isNull: col => row => col(row) === null, and: (...checks) => row => checks.every(check => check(row)) },
    '@/db/schema': { materials: { id: column('material', 'id'), archivedAt: column('material', 'archivedAt') }, subjects: { archivedAt: column('subject', 'archivedAt') }, materialFiles: {} }, '@/db': { db },
    '@/lib/auth': { requireUser: async () => { if (!approved) throw new ApiError(403, 'Aguarde aprovação'); return { id: 'student' }; }, requireContentManager: async () => { if (!manager) throw new ApiError(403, 'Restrito'); return { id: 'assistant' }; } },
    '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler }, '@/lib/mfa': { validateMfa: () => null }, '@/lib/clientRateLimit': { limitClient: async () => {} }, '@/lib/aiOperation': { withAiOperation: (_id, _signal, work) => work() }, '@/lib/pdfValidation': {}, '@/lib/errors': { ApiError, handleError, isUuid }, '@/lib/pdf': {}, '@/lib/rateLimit': {}, '@/lib/audit': {},
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/api/materials/[id]/pdf/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Response, Buffer, require: name => modules[name] });
  return { route: exports, reads: () => reads, data: row.data };
}

test('approved student receives original PDF bytes with private caching and safe inline/download headers', async () => {
  for (const download of [false, true]) {
    const { route, data } = load();
    const res = await route.GET({ nextUrl: new URL(`http://localhost/pdf${download ? '?download=1' : ''}`) }, { params: Promise.resolve({ id }) });
    assert.equal(res.status, 200);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), data);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(res.headers.get('content-disposition').startsWith(download ? 'attachment;' : 'inline;'));
    assert.ok(res.headers.get('content-disposition').includes('%22teste%22.pdf'));
  }
});

test('PDF download enforces approval, archive state, missing files and valid IDs', async () => {
  for (const [options, requestedId, expected] of [
    [{ approved: false }, id, 403], [{ archivedMaterial: true }, id, 404], [{ archivedSubject: true }, id, 404], [{ missing: true }, id, 404], [{}, 'invalid', 404],
  ]) {
    const { route } = load(options);
    const res = await route.GET(null, { params: Promise.resolve({ id: requestedId }) });
    assert.equal(res.status, expected);
  }
  const { route, reads } = load();
  assert.equal((await route.POST(null, { params: Promise.resolve({ id }) })).status, 403);
  assert.equal(reads(), 0, 'Students cannot attach PDFs through direct calls');
});

test('upload fixture is a real selectable-text PDF accepted by the production extractor', async () => {
  const { testPdf } = await import('../helpers/pdf.mjs');
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(testPdf()));
  try {
    const result = await extractText(pdf, { mergePages: true });
    assert.equal(result.totalPages, 1);
    assert.ok(result.text.length >= 400);
    assert.match(result.text, /Academic study material/);
  } finally { pdf.cleanup(); }
});
