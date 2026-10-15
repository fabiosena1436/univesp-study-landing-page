const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tutorPlatformInstructions } = require('../../.test-build/lib/tutorPlatform');

test('platform guidance links to existing screens and respects student and publisher navigation', () => {
  const student = tutorPlatformInstructions({});
  assert.match(student, /\[Materiais \(PDF\)\]\(\/app\/materiais\)/);
  assert.match(student, /\[Nova prova\]\(\/app\/prova\)/);
  assert.match(student, /\[Meu plano\]\(\/app\/plano\)/);
  assert.doesNotMatch(student, /\]\(\/app\/(?:admin|importar|questoes)\)/);
  const assistant = tutorPlatformInstructions({ isAssistant: true });
  assert.match(assistant, /\]\(\/app\/importar\)/);
  assert.doesNotMatch(assistant, /\]\(\/app\/admin\)/);
  const admin = tutorPlatformInstructions({ isAdmin: true });
  assert.match(admin, /Expandir ações registradas/);
  for (const [, route] of admin.matchAll(/\]\((\/[^)]+)\)/g)) {
    assert.ok(fs.existsSync(`src/app${route}/page.tsx`), `Guide links to missing route: ${route}`);
  }
});
