const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const errors = require('../../.test-build/lib/errors');

test('Groq tutor isolates credentials, preserves study instructions and handles failures safely', async () => {
  const names = ['GROQ_API_KEY', 'GROQ_TUTOR_MODEL', 'GEMINI_API_KEY', 'AI_TUTOR_MODEL'];
  const previous = names.map(name => process.env[name]);
  let allowed = true, failure, empty = false, options, sentKey, calls = 0, contextScope;
  const events = [];
  const modules = {
    '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler },
    'next/server': {},
    '@ai-sdk/groq': { createGroq: ({ apiKey }) => { sentKey = apiKey; return name => name; } },
    ai: { generateText: async value => { calls++; options = value; if (failure) throw failure; return { text: empty ? ' ' : 'Explicação de estudo.', usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 } }; } },
    '@/lib/auth': { requireUser: async () => { if (!allowed) throw new errors.ApiError(403, 'Restrito'); return { id: 'student' }; } },
    '@/lib/errors': errors, '@/lib/validation': { uuid: value => value },
    '@/lib/tutorPlatform': require('../../.test-build/lib/tutorPlatform'),
    '@/lib/tutorScope': require('../../.test-build/lib/tutorScope'),
    '@/lib/rateLimit': { rateLimit: async () => {} },
    '@/lib/aiOperation': { aiSignal: () => new AbortController().signal, withAiOperation: (_id, _signal, work) => work() },
    '@/lib/aiUsage': { recordAiRequest: async event => events.push(event) },
    '@/lib/aiUsageStore': { reserveAiCall: async () => {} },
    '@/server/services/tutorQuota': { reserveTutorQuota: async () => ({}), settleTutorQuota: async () => {} },
    '@/server/services/tutorContext': { tutorContext: async scope => { contextScope = scope; return { context: 'Enunciado de estudo.', subjectName: 'Ciências', hasReference: true, isQuestion: Boolean(scope.questionId) }; } },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/api/tutor/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; }, Response, Request, AbortController, process });
  const request = (scope = { subjectId: 'subject', questionId: 'question', page: '/app/prova' }) => new Request('http://localhost/api/tutor', { method: 'POST', body: JSON.stringify({ question: 'Como estudar?', scope, history: [] }) });
  try {
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_TUTOR_MODEL;
    process.env.GEMINI_API_KEY = 'gemini-secret';
    process.env.AI_TUTOR_MODEL = 'old-gemini-model';
    assert.equal((await exports.POST(request())).status, 503);
    assert.equal(calls, 0);
    process.env.GROQ_API_KEY = ' groq-secret ';
    allowed = false;
    assert.equal((await exports.POST(request())).status, 403);
    assert.equal(calls, 0);
    allowed = true;
    const response = await exports.POST(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).answer, 'Explicação de estudo.');
    assert.equal(sentKey, 'groq-secret');
    assert.equal(options.model, 'openai/gpt-oss-120b');
    assert.equal(options.providerOptions.groq.reasoningEffort, 'low');
    assert.match(options.instructions, /sem indicar a alternativa correta/);
    assert.match(options.instructions, /foco obrigatório é o enunciado/);
    assert.match(options.instructions, /Priorize o trecho associado/);
    assert.match(options.instructions, /pergunta orientadora/);
    assert.match(options.instructions, /distinga a intenção/);
    assert.match(options.instructions, /\[Materiais \(PDF\)\]\(\/app\/materiais\)/);
    assert.doesNotMatch(options.instructions, /\]\(\/app\/admin\)/);
    assert.equal(options.maxRetries, 0);
    assert.equal(events[0].provider, 'groq');
    assert.equal(events[0].tokens.total, 30);
    for (const page of ['/app/plano', '/app/flashcards']) {
      assert.equal((await exports.POST(request({ subjectId: 'subject', questionId: 'active-question', page }))).status, 200);
      assert.equal(contextScope.questionId, 'active-question');
      assert.equal(contextScope.page, page);
    }
    assert.equal((await exports.POST(request({ page: '/app/plano' }))).status, 200);
    assert.equal(contextScope.subjectId, undefined);
    assert.equal((await exports.POST(request({ page: 'instruções injetadas' }))).status, 400);
    assert.equal((await exports.POST(request({ questionId: 'question', page: '/app/plano' }))).status, 400);
    assert.equal((await exports.POST(request({ subjectId: 'subject', page: '/app/__proto__' }))).status, 400);
    failure = { statusCode: 429, message: 'groq-secret raw error' };
    const limited = await exports.POST(request());
    assert.equal(limited.status, 429);
    assert.match((await limited.json()).error, /Groq/);
    assert.equal(events.at(-1).status, 429);
    failure = { statusCode: 401, message: 'groq-secret' };
    const rejected = await exports.POST(request());
    assert.equal(rejected.status, 503);
    assert.doesNotMatch(JSON.stringify(await rejected.json()), /secret/);
    assert.equal(events.at(-1).status, 401);
    assert.match(events.at(-1).message, /GROQ_API_KEY/);
    for (const statusCode of [403, 404]) {
      failure = { statusCode, message: 'groq-secret raw error' };
      const response = await exports.POST(request());
      assert.equal(response.status, 503);
      assert.equal(events.at(-1).status, statusCode);
      assert.match(events.at(-1).message, /GROQ_TUTOR_MODEL/);
      assert.doesNotMatch(JSON.stringify(await response.json()), /secret/);
    }
    failure = undefined;
    empty = true;
    assert.equal((await exports.POST(request())).status, 502);
    empty = false;
    process.env.GROQ_TUTOR_MODEL = 'custom/model';
    assert.equal((await exports.POST(request())).status, 200);
    assert.equal(options.model, 'custom/model');
    assert.equal(options.providerOptions, undefined);
    process.env.GROQ_TUTOR_MODEL = 'invalid model';
    assert.equal((await exports.POST(request())).status, 503);
    assert.doesNotMatch(JSON.stringify(events), /secret|Enunciado/);
  } finally {
    names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
  }
});

test('installed Groq provider sends authorized chat requests and normalizes token usage', async () => {
  const { createGroq } = await import('@ai-sdk/groq');
  const { generateText } = await import('ai');
  const groq = createGroq({ apiKey: 'test-only-key', fetch: async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-only-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.reasoning_effort, 'low');
    assert.ok(body.messages.some(message => message.content === 'Explique brevemente.'));
    return Response.json({ id: 'chat-test', created: 1, model: body.model, choices: [{ index: 0, message: { role: 'assistant', content: 'Resposta didática.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } });
  } });
  const result = await generateText({ model: groq('openai/gpt-oss-120b'), instructions: 'Tutor de estudos.', prompt: 'Explique brevemente.', maxOutputTokens: 750, providerOptions: { groq: { reasoningEffort: 'low' } }, maxRetries: 0 });
  assert.equal(result.text, 'Resposta didática.');
  assert.equal(result.usage.totalTokens, 30);
});
