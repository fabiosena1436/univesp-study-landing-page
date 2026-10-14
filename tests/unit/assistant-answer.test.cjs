const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function render(text) {
  const { default: Markdown } = await import('react-markdown');
  const { default: remarkGfm } = await import('remark-gfm');
  const modules = { 'react/jsx-runtime': require('react/jsx-runtime'), 'react-markdown': Markdown, 'remark-gfm': remarkGfm };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/components/AssistantAnswer.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => modules[name] });
  return renderToStaticMarkup(React.createElement(exports.AssistantAnswer, { text }));
}

test('assistant formats Markdown headings, emphasis, nested lists, code and tables', async () => {
  const html = await render('### Plano de estudo\n\nEstude **IA** com *atenção*.\n\n1. Comece aqui\n   - Leia o material\n2. Pratique\n\nUse `variavel`.\n\n| Tema | Dia |\n| --- | --- |\n| IA | Segunda |');
  assert.match(html, /<h3>Plano de estudo<\/h3>/);
  assert.match(html, /<strong>IA<\/strong>/);
  assert.match(html, /<em>atenção<\/em>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<code>variavel<\/code>/);
  assert.match(html, /<table[^>]*>/);
  assert.match(html, /<th>Tema<\/th>/);
  assert.doesNotMatch(html, /\*\*IA\*\*|### Plano/);
});

test('assistant ignores embedded HTML, images and unsafe link protocols', async () => {
  const html = await render('<script>alert(1)</script>\n\n![tracker](https://example.com/track.png)\n\n[Ruim](javascript:alert%281%29)\n\n[Referência](https://example.com/estudo)');
  assert.doesNotMatch(html, /<script|<img|javascript:|track\.png/);
  assert.match(html, /href="https:\/\/example.com\/estudo"/);
  assert.match(html, /rel="noopener noreferrer"/);
});
