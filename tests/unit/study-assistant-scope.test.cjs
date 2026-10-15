const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function pageScope(path, states) {
  let scope;
  const exports = {};
  const modules = {
    react: { useState: initial => [states.length ? states.shift() : initial, () => {}], useEffect: () => {}, useRef: value => ({ current: value }) },
    'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': () => null, 'lucide-react': {},
    '@/components/AppShell': { useApp: () => ({ subjects: [] }), toast: () => {}, useStudyAssistantScope: value => { scope = value; } },
    '@/components/ui': {}, '@/lib/api': {},
  };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; } });
  exports.default();
  return scope;
}

test('Meu plano sends the active review question and clears it when the review is empty', () => {
  for (const id of ['first-question', 'next-question']) {
    const active = { id, subjectId: 'actual-subject', subjectName: 'Matéria da revisão', options: [] };
    const scope = pageScope('src/app/app/plano/page.tsx', ['', {}, active, null, false, false]);
    assert.equal(scope.scope.questionId, id);
    assert.equal(scope.scope.subjectId, 'actual-subject');
    assert.equal(scope.subjectName, 'Matéria da revisão');
  }
  assert.equal(pageScope('src/app/app/plano/page.tsx', ['', { totalTracked: 0 }, null, null, false, false]), null);
});

test('Flashcards follows the visible card, including all-subject sessions, and clears during loading', () => {
  const cards = [
    { id: 'first-card', subjectId: 'math', subjectName: 'Matemática' },
    { id: 'second-card', subjectId: 'science', subjectName: 'Ciências' },
  ];
  for (const index of [0, 1]) {
    const scope = pageScope('src/app/app/flashcards/page.tsx', [cards, index, false, '', false, '', false]);
    assert.equal(scope.scope.questionId, cards[index].id);
    assert.equal(scope.scope.subjectId, cards[index].subjectId);
  }
  assert.equal(pageScope('src/app/app/flashcards/page.tsx', [cards, 0, false, '', false, '', true]), null);
  assert.equal(pageScope('src/app/app/flashcards/page.tsx', [[], 0, false, '', false, '', false]), null);
});

test('scope registration identifies the current page and clears the previous activity on cleanup', () => {
  let currentPage = '/app/plano', cleanup;
  const scopes = [];
  const exports = {};
  const modules = {
    react: { createContext: () => ({}), useContext: () => ({ setAssistantScope: value => scopes.push(value) }), useEffect: effect => { cleanup = effect(); } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { usePathname: () => currentPage },
    'next/link': {}, 'motion/react': {}, 'lucide-react': {}, '@/lib/api': {}, './Logo': {}, './StudyAssistant': {}, './ui': {},
    '@/lib/tutorScope': require('../../.test-build/lib/tutorScope'),
  };
  const code = ts.transpileModule(fs.readFileSync('src/components/AppShell.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw new Error(name); return modules[name]; } });
  exports.useStudyAssistantScope({ scope: { subjectId: 'math', questionId: 'review-question' }, subjectName: 'Matemática' });
  assert.equal(scopes.at(-1).scope.page, '/app/plano');
  assert.equal(scopes.at(-1).scope.questionId, 'review-question');
  cleanup();
  assert.equal(scopes.at(-1), null);
  currentPage = '/app/flashcards';
  exports.useStudyAssistantScope({ scope: { subjectId: 'science', questionId: 'new-card' }, subjectName: 'Ciências' });
  assert.equal(scopes.at(-1).scope.page, '/app/flashcards');
  assert.equal(scopes.at(-1).scope.questionId, 'new-card');
});
