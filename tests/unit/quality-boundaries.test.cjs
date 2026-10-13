const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { withAiOperation, aiSignal } = require('../../.test-build/lib/aiOperation');
const mfa = require('../../.test-build/lib/mfa');

test('original and attachment routes share the same PDF boundary through the proxy', () => {
  const code = ts.transpileModule(fs.readFileSync('src/proxy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Response, Headers, crypto: require('node:crypto'), process: { env: {} }, require: name => name === '@/lib/pdfValidation' ? require('../../.test-build/lib/pdfValidation') : { NextResponse: { next: () => new Response(null), json: Response.json } } });
  for (const path of ['/api/materials', '/api/materials/8aad91a1-5678-4123-9123-123456789abc/pdf']) {
    for (const [bytes, expected] of [[3 * 1024 * 1024, 200], [4 * 1024 * 1024 + 8192, 200], [5 * 1024 * 1024, 413]]) {
      const response = exports.proxy({ method: 'POST', headers: new Headers({ 'content-length': String(bytes), origin: 'https://app.example' }), nextUrl: new URL('https://app.example' + path) });
      assert.equal(response.status, expected, path);
    }
  }
});

test('AI stages reuse a single deadline and cancellation prevents extending its lifetime', async () => {
  const controller = new AbortController();
  await withAiOperation('user', controller.signal, async () => {
    const first = aiSignal();
    await Promise.resolve();
    assert.equal(aiSignal(), first);
    controller.abort();
    assert.equal(aiSignal().aborted, true);
    assert.throws(() => aiSignal().throwIfAborted());
  });
});

test('MFA secrets are encrypted; accepted tokens and recovery codes cannot be replayed', () => {
  const previous = process.env.MFA_ENCRYPTION_KEY;
  process.env.MFA_ENCRYPTION_KEY = '22'.repeat(32);
  try {
    const secret = mfa.newMfaSecret();
    const encrypted = mfa.encryptMfaSecret(secret);
    assert.notEqual(encrypted, secret);
    assert.equal(mfa.decryptMfaSecret(encrypted), secret);
    const record = { email: 'test@aluno.univesp.br', mfaSecret: encrypted, mfaLastUsedStep: null, mfaRecoveryHashes: [] };
    const time = 1791910000000;
    const token = mfa.mfaTotp(secret, record.email).generate({ timestamp: time });
    const accepted = mfa.validateMfa(record, token, time);
    assert.ok(accepted?.mfaLastUsedStep);
    assert.equal(mfa.validateMfa({ ...record, ...accepted }, token, time), null);
    const [recovery] = mfa.newRecoveryCodes();
    record.mfaRecoveryHashes = [mfa.recoveryHash(recovery)];
    assert.deepEqual(mfa.validateMfa(record, recovery), { mfaRecoveryHashes: [] });
    assert.equal(mfa.validateMfa({ ...record, mfaRecoveryHashes: [] }, recovery), null);
  } finally { if (previous === undefined) delete process.env.MFA_ENCRYPTION_KEY; else process.env.MFA_ENCRYPTION_KEY = previous; }
});

test('security backport rejects deeply nested brace patterns and preserves normal glob expansion', () => {
  const braces = require('braces');
  assert.deepEqual(braces.expand('src/{app,lib}/*.ts'), ['src/app/*.ts', 'src/lib/*.ts']);
  assert.throws(() => braces('{'.repeat(2000) + 'a,b' + '}'.repeat(2000)), /nesting/);
});
