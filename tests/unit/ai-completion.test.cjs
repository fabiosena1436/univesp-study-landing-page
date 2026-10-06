const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeQuestionAnswers, generateQuestions } = require('../../.test-build/lib/ai');

const question = { statement: 'Qual é o resultado da soma de dois com dois?', options: [{ key: 'B', text: 'Quatro' }, { key: 'A', text: 'Três' }], correctKey: null, feedback: '' };
const response = (text) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
async function withProvider(run) {
  const previous = { fetch: global.fetch, key: process.env.GEMINI_API_KEY, models: process.env.GEMINI_MODELS };
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODELS = 'test-model';
  try { await run(); }
  finally {
    global.fetch = previous.fetch;
    for (const [name, value] of [['GEMINI_API_KEY', previous.key], ['GEMINI_MODELS', previous.models]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

test('completion enables research, then validates JSON without changing the original question', async () => withProvider(async () => {
  const bodies = [];
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    assert.equal(init.headers['x-goog-api-key'], 'test-key');
    return bodies.length === 1 ? response('Questão 0: B. Dois mais dois são quatro.') : response(JSON.stringify({ answers: [{ id: 0, correctKey: 'B', feedback: 'Dois mais dois são quatro.' }] }));
  };
  const input = [{ ...question, tempId: 'original-id', warnings: [] }];
  const [result] = await completeQuestionAnswers(input);
  assert.deepEqual(bodies[0].tools, [{ google_search: {} }]);
  assert.equal(bodies[0].generationConfig.responseMimeType, undefined);
  assert.equal(bodies[1].tools, undefined);
  assert.equal(bodies[1].generationConfig.responseMimeType, 'application/json');
  assert.equal(result.tempId, 'original-id');
  assert.equal(result.correctKey, 'B'); assert.ok(result.feedback);
  assert.equal(result.statement, question.statement); assert.deepEqual(result.options, question.options);
  assert.equal(input[0].correctKey, null);
}));

test('existing questions extracted from a PDF are completed by Gemini', async () => withProvider(async () => {
  global.fetch = async (_url, init) => JSON.parse(init.body).tools ? response('Questão 0: B; a soma é quatro.') : response(JSON.stringify({ answers: [{ id: 0, correctKey: 'B', feedback: 'A soma de dois e dois é quatro.' }] }));
  const result = await generateQuestions('Questão 1\nQual é o resultado da soma de dois com dois?\nA. Três\nB. Quatro', 10, 'PDF sem gabarito');
  assert.equal(result.engine, 'gemini'); assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].correctKey, 'B'); assert.ok(result.questions[0].feedback);
  assert.deepEqual(result.questions[0].options.map(o => o.key), ['A', 'B']);
}));

test('completion preserves existing answers and explanations and skips fully complete questions', async () => withProvider(async () => {
  const complete = { ...question, correctKey: 'B', feedback: 'Explicação original.' };
  global.fetch = async () => { throw new Error('No request expected'); };
  assert.deepEqual(await completeQuestionAnswers([complete]), [complete]);
  let calls = 0;
  global.fetch = async () => ++calls === 1 ? response('Resposta B.') : response(JSON.stringify({ answers: [{ id: 1, correctKey: 'B', feedback: 'Nova explicação.' }, { id: 2, correctKey: 'B', feedback: 'Nova explicação.' }] }));
  const result = await completeQuestionAnswers([complete, { ...question, correctKey: 'B' }, { ...question, feedback: 'Explicação original.' }]);
  assert.deepEqual(result[0], complete); assert.equal(result[1].correctKey, 'B'); assert.equal(result[1].feedback, 'Nova explicação.');
  assert.equal(result[2].feedback, 'Explicação original.'); assert.equal(result[2].correctKey, 'B');
}));

test('invalid, ambiguous, missing and duplicate answers never pass validation', async () => withProvider(async () => {
  for (const answers of [[], [{ id: 0, correctKey: null, feedback: 'Ambígua.' }], [{ id: 0, correctKey: 'F', feedback: 'Inválida.' }], [{ id: 0, correctKey: 'B', feedback: '' }], [{ id: 0, correctKey: 'B', feedback: 'ok' }, { id: 0, correctKey: 'A', feedback: 'ok' }]]) {
    global.fetch = async (_url, init) => JSON.parse(init.body).tools ? response('Pesquisa.') : response(JSON.stringify({ answers }));
    await assert.rejects(completeQuestionAnswers([question]), error => error.status === 502);
  }
  global.fetch = async (_url, init) => JSON.parse(init.body).tools ? response('Pesquisa.') : response(JSON.stringify({ answers: [{ id: 0, correctKey: 'A', feedback: 'Mudança indevida.' }] }));
  await assert.rejects(completeQuestionAnswers([{ ...question, correctKey: 'B' }]), error => error.status === 502);
}));

test('completion errors expose quota and missing configuration without silent local fallback', async () => withProvider(async () => {
  global.fetch = async () => Response.json({}, { status: 429 });
  await assert.rejects(completeQuestionAnswers([question]), /cota/);
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(completeQuestionAnswers([question]), error => error.status === 503 && /GEMINI_API_KEY/.test(error.message));
}));
