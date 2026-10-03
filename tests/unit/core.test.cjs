const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gradeAnswers, validateOptions, passwordError, pageParams } = require('../../.test-build/lib/validation');
const { coerceQuestions, selectChunks, generateQuestions } = require('../../.test-build/lib/ai');
const { createResetToken, hashResetToken } = require('../../.test-build/lib/passwordReset');
const options = ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: 'Alternativa ' + key }));
const question = { id: 'q1', subjectId: 's1', correctKey: 'B', options };

test('registration allows institutional addresses and only the explicit personal exception', () => {
  const { registrationEmailAllowed } = require('../../.test-build/lib/constants');
  assert.equal(registrationEmailAllowed('26241463@aluno.univesp.br'), true);
  assert.equal(registrationEmailAllowed(' FABIOSENA1436@GMAIL.COM '), true);
  assert.equal(registrationEmailAllowed('other@gmail.com'), false);
  assert.equal(registrationEmailAllowed('fabiosena1436+teste@gmail.com'), false);
  assert.equal(registrationEmailAllowed('user@aluno.univesp.br.example.com'), false);
});

test('Neon migrations use direct connection and refuse transaction pool endpoints', async () => {
  const { migrationDatabaseUrl } = await import('../../scripts/database-url.mjs');
  const direct = 'postgresql://test:fake@ep-test.region.aws.neon.tech/test?sslmode=require';
  const pooled = direct.replace('ep-test.', 'ep-test-pooler.');
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct }), direct);
  assert.throws(() => migrationDatabaseUrl({ DATABASE_URL: pooled }));
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: 'postgresql://app:app@localhost:55432/app_db' }), 'postgresql://app:app@localhost:55432/app_db');
  assert.throws(() => migrationDatabaseUrl({}));
});
test('server ignores forged isCorrect and calculates grade', () => {
  assert.equal(gradeAnswers([{ questionId: 'q1', selectedKey: 'A', isCorrect: true }], [question], 's1')[0].isCorrect, false);
  assert.equal(gradeAnswers([{ questionId: 'q1', selectedKey: 'B', isCorrect: false }], [question], 's1')[0].isCorrect, true);
});
test('reject repeated questions, foreign subjects, missing answer and invalid option', () => {
  assert.throws(() => gradeAnswers([{ questionId: 'q1' }, { questionId: 'q1' }], [question], 's1'));
  assert.throws(() => gradeAnswers([{ questionId: 'q1' }], [question], 's2'));
  assert.throws(() => gradeAnswers([{ questionId: 'q1', selectedKey: 'F' }], [question], 's1'));
  assert.throws(() => gradeAnswers([{ questionId: 'q1' }], [{ ...question, correctKey: null }], 's1'));
  assert.throws(() => gradeAnswers([null], [question], 's1'));
});
test('unanswered questions are incorrect', () => assert.equal(gradeAnswers([{ questionId: 'q1', selectedKey: null }], [question], 's1')[0].isCorrect, false));
test('rejects duplicate letters, empty alternatives, invalid answer', () => {
  assert.throws(() => validateOptions([{ key: 'A', text: 'one' }, { key: 'A', text: 'two' }], 'A'));
  assert.throws(() => validateOptions([{ key: 'A', text: '' }, { key: 'B', text: 'two' }], 'B'));
  assert.throws(() => validateOptions(options, 'F'));
});
test('password policy respects UTF-8 bcrypt byte limit', () => {
  assert.equal(passwordError('a'.repeat(72)), null);
  assert.ok(passwordError('a'.repeat(73)));
  assert.ok(passwordError('😀'.repeat(19)));
  assert.ok(passwordError('short'));
});
test('pagination rejects NaN, negative and fractional values', () => {
  for (const value of ['NaN', '-1', '1.1']) assert.throws(() => pageParams(new URLSearchParams('offset=' + value)));
  assert.equal(pageParams(new URLSearchParams('limit=1000')).limit, 100);
});
const excerpt = 'O material descreve um conceito verificável para a resposta correta.';
const raw = { statement: 'Qual alternativa descreve o conceito apresentado?', options, correctKey: 'B', feedback: 'A alternativa B corresponde ao conceito.', sourceExcerpt: excerpt };
test('AI preserves original keys when alternatives arrive out of order', () => {
  const result = coerceQuestions({ questions: [{ ...raw, options: [options[4], ...options.slice(0, 4)] }] }, excerpt);
  assert.equal(result[0].correctKey, 'B');
  assert.equal(result[0].options.find(o => o.key === 'B').text, 'Alternativa B');
});
test('AI rejects malformed and ungrounded questions', () => {
  for (const q of [{ ...raw, options: options.slice(0, 4) }, { ...raw, sourceExcerpt: 'Texto que não existe no material, mas parece confiável.' }, { ...raw, correctKey: null }, { ...raw, options: [...options.slice(0, 4), options[0]] }]) {
    assert.deepEqual(coerceQuestions({ questions: [q] }, excerpt), []);
  }
  assert.deepEqual(coerceQuestions(null, excerpt), []);
});
test('large materials sample beginning, middle and end and disclose partial coverage', () => {
  const material = 'BEGIN ' + 'x'.repeat(150000) + ' END';
  const result = selectChunks(material, 10);
  assert.equal(result.chunks.length, 3); assert.equal(result.partial, true);
  assert.ok(result.chunks[0].startsWith('BEGIN')); assert.ok(result.chunks[2].endsWith('END'));
});
test('small count never creates more chunks than requested questions', () => assert.equal(selectChunks('x'.repeat(90000), 1).chunks.length, 1));
test('local mode does not claim to generate new questions', async () => {
  const previous = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  try { const result = await generateQuestions('Conteúdo sem alternativas sobre um conceito básico.', 5, 'Teste'); assert.equal(result.questions.length, 0); assert.match(result.note, /não gera questões/); }
  finally { if (previous) process.env.GEMINI_API_KEY = previous; }
});
test('reset tokens are independent, hashed and reproducible only from original token', () => {
  const a = createResetToken(), b = createResetToken();
  assert.notEqual(a.token, b.token); assert.notEqual(a.token, a.tokenHash); assert.equal(hashResetToken(a.token), a.tokenHash);
});

test('AI request validates provider response and sends credentials in header, never URL', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModels = process.env.GEMINI_MODELS;
  process.env.GEMINI_API_KEY = 'fake-test-key'; process.env.GEMINI_MODELS = 'test-model';
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.ok(!url.includes('fake-test-key'));
    assert.equal(init.headers['x-goog-api-key'], 'fake-test-key');
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ questions: [raw] }) }] } }] });
  };
  try {
    const result = await generateQuestions(excerpt, 1, 'Material de teste');
    assert.equal(result.engine, 'gemini'); assert.equal(result.questions.length, 1); assert.equal(calls, 1);
    assert.equal(result.questions[0].sourceExcerpt, excerpt);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalModels === undefined) delete process.env.GEMINI_MODELS; else process.env.GEMINI_MODELS = originalModels;
  }
});
