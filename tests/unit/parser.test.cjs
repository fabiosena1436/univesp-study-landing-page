const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReviewText } = require('../../.test-build/lib/parser');
const fs = require('node:fs');
const path = require('node:path');
const { completeQuestionAnswers, importQuestions } = require('../../.test-build/lib/ai');

test('fully answered Markdown import does not need a Gemini call', async () => {
  const text = fs.readFileSync(path.join(__dirname, '../fixtures/markdown-assessment.md'), 'utf8');
  const parsed = parseReviewText(text).questions;
  const previousFetch = global.fetch;
  global.fetch = async () => { throw new Error('This complete assessment must not consume API quota'); };
  try { assert.deepEqual(await completeQuestionAnswers(parsed, text), parsed); }
  finally { global.fetch = previousFetch; }
});

test('imports four Markdown assessment questions, answers and detailed feedback without mixing sections', () => {
  const result = parseReviewText(fs.readFileSync(path.join(__dirname, '../fixtures/markdown-assessment.md'), 'utf8'));
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 4);
  assert.deepEqual(result.questions.map(q => q.correctKey), ['A', 'E', 'B', 'D']);
  for (const q of result.questions) {
    assert.deepEqual(q.options.map(o => o.key), ['A', 'B', 'C', 'D', 'E']);
    assert.deepEqual(q.warnings, []);
    assert.doesNotMatch(q.statement, /Texto da questão|Completo|Resumo da tentativa|Questão \d+.*Resposta|\*\*/);
    for (const o of q.options) assert.doesNotMatch(o.text, /✅|Feedback|Sua resposta|A resposta correta|Resumo do gabarito/);
    assert.ok(q.feedback.length > 50);
    assert.doesNotMatch(q.feedback, /Sua resposta está correta/);
  }
  assert.equal(result.questions[0].options[4].text, 'R$ 130,00');
  assert.match(result.questions[0].feedback, /150 − 50 \+ 30 − 80 − 40 \+ 100 = 110/);
  assert.match(result.questions[0].feedback, /\| Transação \| Valor \| Saldo acumulado \|/);
  assert.match(result.questions[2].statement, /IV\. A propriedade distributiva/);
  assert.match(result.questions[2].feedback, /a × \(b − c\)/);
  assert.match(result.questions[3].feedback, /36 ÷ 4 = 9/);
  assert.doesNotMatch(result.questions[3].feedback, /Resumo do gabarito/);
});

test('Gemini organizes unfamiliar raw platform copies and completes only missing answers', async () => {
  const previous = { fetch: global.fetch, key: process.env.GEMINI_API_KEY, models: process.env.GEMINI_MODELS, search: process.env.GEMINI_GOOGLE_SEARCH };
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODELS = 'test-model'; delete process.env.GEMINI_GOOGLE_SEARCH;
  const input = 'Curso: Matemática\nFinalizada\nPergunta 1: Quanto é dois mais dois?\nOpção 1 → Três\nOpção 2 → Quatro\nContinuar\nVoltar';
  const bodies = [];
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    const data = bodies.length === 1
      ? { overflow: false, questions: [{ statement: 'Quanto é dois mais dois?', options: [{ key: 'A', text: 'Três' }, { key: 'B', text: 'Quatro' }], correctKey: null, feedback: '' }] }
      : { answers: [{ id: 0, correctKey: 'B', feedback: 'Dois mais dois resulta em quatro.' }] };
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] });
  };
  try {
    const result = await importQuestions(input);
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].contents[0].parts[0].text, input);
    assert.ok(bodies[0].generationConfig.responseJsonSchema);
    assert.equal(bodies[0].tools, undefined);
    assert.equal(result.questions[0].correctKey, 'B');
    assert.equal(result.questions[0].statement, 'Quanto é dois mais dois?');
    assert.equal(result.questions[0].feedback, 'Dois mais dois resulta em quatro.');
    assert.deepEqual(result.errors, []);
    global.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ overflow: false, questions: [{ statement: 'Quanto é dois mais dois?', options: [{ key: 'A', text: 'Alternativa inventada' }, { key: 'B', text: 'Quatro' }], correctKey: 'B', feedback: 'Original.' }] }) }] } }] });
    await assert.rejects(importQuestions(input), /alterou alternativas/);
  } finally {
    global.fetch = previous.fetch;
    for (const [name, value] of [['GEMINI_API_KEY', previous.key], ['GEMINI_MODELS', previous.models], ['GEMINI_GOOGLE_SEARCH', previous.search]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('supports Markdown lists, short answers, explicit letters and different response separators', () => {
  for (const separator of ['—', '–', '-', '']) {
    const result = parseReviewText(`## Questão 1\n**Texto da questão**\nQuanto é dois mais dois?\n**Questão 1 ${separator} Resposta**\n- **A.** 3\n- **B.** 4 ✅\n- **C.** 5\n**Feedback**\nDois mais dois resulta em quatro.\n**A resposta correta é: 4**`);
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].correctKey, 'B');
    assert.equal(result.questions[0].feedback, 'Dois mais dois resulta em quatro.');
  }
  for (const answer of ['B', 'alternativa B', 'B — quatro']) {
    assert.equal(parseReviewText(`Quanto é dois mais dois?\nA. três\nB. quatro\nA resposta correta é: ${answer}`).questions[0].correctKey, 'B');
  }
});

test('uses a check mark without a separate answer but flags contradictory or multiple marks', () => {
  const input = `Questão 1\nQuanto é dois mais dois?\nA. três\nB. quatro ✅\nFeedback\nDois mais dois resulta em quatro.`;
  assert.equal(parseReviewText(input).questions[0].correctKey, 'B');
  assert.deepEqual(parseReviewText(input).questions[0].warnings, []);
  for (const invalid of [input + '\nA resposta correta é: A', input.replace('A. três', 'A. três ✅')]) {
    const q = parseReviewText(invalid).questions[0];
    assert.equal(q.correctKey, null);
    assert.match(q.warnings[0], /conflitantes/);
  }
});

test('preserves plain Moodle copies, multiline options, introductory metadata and isolated questions', () => {
  const text = `Curso e resumo da tentativa\nNota: 10\nQuestão 1\nCorreto\nAtingiu 2,50 de 2,50\nTexto da questão\nQual é a diferença entre os conjuntos C e M?\nQuestão 1 Resposta\na. Somente os elementos\nque estão em C e não estão em M.\nb. Todos os elementos dos dois conjuntos.\nFeedback\nA diferença exclui os elementos compartilhados.\nA resposta correta é: Somente os elementos que estão em C e não estão em M.`;
  const q = parseReviewText(text).questions[0];
  assert.equal(q.correctKey, 'A');
  assert.equal(q.statement, 'Qual é a diferença entre os conjuntos C e M?');
  assert.equal(q.options[0].text, 'Somente os elementos que estão em C e não estão em M.');
  assert.equal(parseReviewText('Qual é o elemento neutro da multiplicação?\nA. zero\nB. um\nA resposta correta é: um').questions[0].correctKey, 'B');
});
