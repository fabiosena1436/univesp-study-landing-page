const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const usage = require('../../.test-build/lib/aiUsage');
const errors = require('../../.test-build/lib/errors');

test('token accounting uses provider totals and preserves missing values', () => {
  assert.deepEqual(usage.tokenUsage({ promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 65 }), { input: 10, output: 20, thinking: 30, total: 65 });
  assert.deepEqual(usage.tokenUsage(null), { input: null, output: null, thinking: null, total: null });
  assert.deepEqual(usage.tokenUsage({ promptTokenCount: -3, candidatesTokenCount: '42', totalTokenCount: 0 }), { input: null, output: null, thinking: null, total: 0 });
});

const quota = (quotaId, quotaValue) => ({ error: { message: 'Secret provider text must not be displayed', details: [{ violations: [{ quotaId, quotaValue }] }, { retryDelay: '12.4s' }] } });
test('quota diagnostics distinguish minute requests, tokens, daily limits and zero quota safely', () => {
  assert.match(usage.quotaDiagnostic(quota('GenerateRequestsPerMinutePerProject')).message, /solicitações por minuto/);
  assert.match(usage.quotaDiagnostic(quota('GenerateContentInputTokensPerMinute')).message, /tokens por minuto/);
  assert.match(usage.quotaDiagnostic(quota('GenerateRequestsPerDayPerProject')).message, /cota diária/);
  assert.match(usage.quotaDiagnostic(quota('GenerateRequestsPerMinute', '0')).message, /cota zero/);
  assert.equal(usage.quotaDiagnostic(quota('GenerateRequestsPerMinute')).retryAfter, 13);
  assert.doesNotMatch(usage.quotaDiagnostic(quota('unknown')).message, /Secret/);
  assert.equal(usage.quotaDiagnostic(null, '42').retryAfter, 42);
  assert.equal(usage.quotaDiagnostic(null, 'not-a-duration').retryAfter, null);
  assert.equal(usage.quotaDiagnostic({ error: { details: 'invalid' } }).retryAfter, null);
});

function loadFile(path, modules, extras = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => { if (!(name in modules)) throw new Error(name); return modules[name]; }, Response, Request, AbortSignal, process, ...extras });
  return exports;
}
test('every Gemini attempt records usage, including failed requests and invalid content', async () => {
  const events = [];
  let status = 200;
  const source = 'O conhecimento científico é falível e pode ser revisado quando surgem evidências.';
  const question = { statement: 'Por que o conhecimento científico pode ser revisado?', options: ['A','B','C','D','E'].map(key => ({ key, text: `Alternativa ${key}` })), correctKey: 'B', feedback: 'Novas evidências permitem revisar o conhecimento.', sourceExcerpt: source };
  const ai = loadFile('src/lib/ai.ts', {
    './generatedQuestion': {}, './parser': require('../../.test-build/lib/parser'), './validation': require('../../.test-build/lib/validation'), './errors': errors,
    './aiUsage': { ...usage, geminiModels: () => ['test-model'], recordAiRequest: async (event) => { events.push(event); } },
  }, { fetch: async () => status === 200 ? Response.json({ usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 150 }, candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: [question] }) }] } }] }) : Response.json(quota('GenerateRequestsPerMinutePerProject'), { status }) });
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'secret-test-key';
  try {
    await ai.generateQuestions(source, 1, 'Teste');
    assert.equal(events.length, 1); assert.equal(events[0].tokens.total, 150); assert.equal(events[0].model, 'test-model');
    assert.doesNotMatch(JSON.stringify(events), /secret-test-key|conhecimento científico/);
    status = 429;
    await assert.rejects(ai.generateQuestions(source, 1, 'Teste'), /solicitações por minuto/);
    assert.equal(events.length, 2); assert.equal(events[1].status, 429); assert.equal(events[1].retryAfter, 13);
    status = 200; question.correctKey = null;
    await assert.rejects(ai.generateQuestions(source, 1, 'Teste'));
    assert.equal(events.length, 3); assert.equal(events[2].tokens.total, 150);
  } finally { if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});

test('usage endpoint authenticates admins before querying telemetry and disables caching', async () => {
  let allowed = false, reads = 0;
  const endpoint = loadFile('src/app/api/admin/ai-usage/route.ts', {
    '@/lib/auth': { requireAdmin: async () => { if (!allowed) throw new errors.ApiError(403, 'Restrito'); } },
    '@/lib/errors': errors,
    '@/lib/aiUsageStore': { readAiUsage: async () => { reads++; return { configured: true, models: ['test-model'] }; } },
  });
  assert.equal((await endpoint.GET()).status, 403); assert.equal(reads, 0);
  allowed = true;
  const result = await endpoint.GET();
  assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'no-store'); assert.equal(reads, 1);
});
