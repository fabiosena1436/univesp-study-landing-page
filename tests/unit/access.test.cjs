const test = require('node:test');
const assert = require('node:assert/strict');
const { canStudy, normalizeWhatsapp, parseAuthorizedEmails, whatsappApprovalUrl } = require('../../.test-build/lib/access.js');

test('approval and email confirmation are independent gates; administrators remain available', () => {
  for (const accessStatus of ['pending', 'rejected', undefined]) {
    assert.equal(canStudy({accessStatus, emailVerifiedAt: new Date()}), false);
    assert.equal(canStudy({accessStatus, emailVerifiedAt: null}), false);
  }
  assert.equal(canStudy({accessStatus: 'approved', emailVerifiedAt: null}), false);
  assert.equal(canStudy({accessStatus: 'approved', emailVerifiedAt: new Date()}), true);
  assert.equal(canStudy({isAdmin: true}), true);
});

test('Brazilian WhatsApp contacts normalize for wa.me and reject injection and bad lengths', () => {
  assert.equal(normalizeWhatsapp('(11) 99999-1234'), '5511999991234');
  assert.equal(normalizeWhatsapp('+55 (21) 3333-1234'), '552133331234');
  for (const value of ['', undefined, 11999991234, '+1 202 555 0199', '5511999991234?text=spam', '<script>', '123', '5501999991234']) assert.equal(normalizeWhatsapp(value), null);
  const link = whatsappApprovalUrl('5511999991234', 'José & Ana', 'https://example.com');
  assert.ok(link.startsWith('https://wa.me/5511999991234?text='));
  assert.ok(decodeURIComponent(link).includes('José & Ana'));
  assert.equal(whatsappApprovalUrl('invalid', 'A', 'https://example.com'), null);
});

test('bulk authorization validates the whole list and handles normalization, duplicates and limits', () => {
  assert.deepEqual(parseAuthorizedEmails(' ALUNO@ALUNO.UNIVESP.BR\naluno@aluno.univesp.br, outra@example.com; terceira@example.com'), ['aluno@aluno.univesp.br', 'outra@example.com', 'terceira@example.com']);
  for (const value of ['', ['a@example.com'], 'a@example.com invalido', Array(501).fill('a@example.com').join('\n')]) assert.throws(() => parseAuthorizedEmails(value));
});
