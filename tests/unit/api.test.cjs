const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ApiClientError } = require('../../.test-build/lib/api.js');

test('login preserves invalid credentials while protected pages redirect expired sessions', async (t) => {
  const originalWindow = global.window;
  t.mock.method(global, 'fetch', async () => Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 }));
  try {
    global.window = { location: { pathname: '/entrar', href: '/entrar' } };
    await assert.rejects(api('/api/auth/login'), (err) => err instanceof ApiClientError && err.status === 401 && err.message === 'E-mail ou senha incorretos.');
    assert.equal(global.window.location.href, '/entrar');
    global.window.location = { pathname: '/app/perfil', href: '/app/perfil' };
    await assert.rejects(api('/api/profile'), { message: 'Sessão expirada. Entre novamente.' });
    assert.equal(global.window.location.href, '/entrar');
    global.window.location = { pathname: '/application', href: '/application' };
    await assert.rejects(api('/api/auth/login'), { message: 'E-mail ou senha incorretos.' });
    assert.equal(global.window.location.href, '/application');
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
