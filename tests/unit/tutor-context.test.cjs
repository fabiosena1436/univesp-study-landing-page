const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('generic quiz hint retrieves material about the actual question, without alternatives or answers', async () => {
  const schema = { subjects: { name: 'subject' }, questions: { statement: 'statement', sourceExcerpt: 'sourceExcerpt', materialId: 'materialId' }, materials: { content: 'content', title: 'title' } };
  const statement = 'Por que os modelos de linguagem geram alucinações expressando segurança e assertividade?';
  const relevant = 'Modelos de linguagem e alucinações: a avaliação em benchmarks penaliza a declaração de desconhecimento. Incentivos de pontuação podem favorecer respostas confiantes, mesmo incorretas.';
  const records = new Map([
    [schema.subjects, { id: 'subject', name: 'IA' }],
    [schema.questions, { statement, sourceExcerpt: '', materialId: 'material' }],
    [schema.materials, { title: 'Avaliação de modelos', content: 'Conteúdo administrativo sobre horários e inscrições. '.repeat(250) + relevant }],
  ]);
  const modules = {
    'drizzle-orm': { and: () => null, desc: () => null, eq: () => null, isNull: () => null, sql: () => null },
    '@/db/schema': schema, '@/lib/errors': require('../../.test-build/lib/errors'),
    '@/db': { db: { select: columns => ({ from: table => {
      if (table === schema.questions) assert.deepEqual(Object.keys(columns).sort(), ['materialId', 'sourceExcerpt', 'statement']);
      const builder = { where: () => builder, limit: async () => [records.get(table)] };
      return builder;
    } }) } },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/server/services/tutorContext.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] });
  const source = await exports.tutorContext({ subjectId: 'subject', questionId: 'question' }, 'Dê uma dica sem revelar a resposta');
  assert.equal(source.isQuestion, true);
  assert.equal(source.hasReference, true);
  assert.ok(source.context.includes(statement));
  assert.match(source.context, /avaliação em benchmarks/);
  assert.match(source.context, /declaração de desconhecimento/);
  assert.doesNotMatch(source.context, /correctKey|Resposta correta|Alternativa A/);
});
