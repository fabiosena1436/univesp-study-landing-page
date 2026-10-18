const test = require('node:test');
const assert = require('node:assert/strict');
const { api, ApiClientError } = require('../../.test-build/lib/api.js');

test('successful message and announcement mutations refresh notifications; reads and failures do not', async t => {
  const originalWindow = global.window;
  const events = [];
  let status = 200;
  t.mock.method(global, 'fetch', async () => Response.json({}, { status }));
  global.window = { dispatchEvent: event => events.push(event.type) };
  try {
    await api('/api/support', { method: 'PATCH' });
    await api('/api/announcements', { method: 'POST' });
    await api('/api/announcements', { method: 'PATCH' });
    await api('/api/announcements');
    status = 403;
    await assert.rejects(api('/api/announcements', { method: 'PATCH' }));
    assert.deepEqual(events, Array(3).fill('repete:notifications'));
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});

test('login preserves invalid credentials while protected pages redirect expired sessions', async (t) => {
  const originalWindow = global.window;
  t.mock.method(global, 'fetch', async () => Response.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 }));
  try {
    let expired = 0;
    const oldEvent = global.CustomEvent;
    t.after(() => { global.CustomEvent = oldEvent; });
    global.CustomEvent = class { constructor(type) { this.type = type; } };
    global.window = { dispatchEvent: event => { if (event.type === "repete:unauthorized") expired++; }, location: { pathname: '/entrar', href: '/entrar' } };
    await assert.rejects(api('/api/auth/login'), (err) => err instanceof ApiClientError && err.status === 401 && err.message === 'E-mail ou senha incorretos.');
    assert.equal(global.window.location.href, '/entrar');
    global.window.location = { pathname: '/app/perfil', href: '/app/perfil' };
    await assert.rejects(api('/api/profile'), { message: 'Sessão expirada. Entre novamente.' });
    assert.equal(expired, 1);
    global.window.location = { pathname: '/application', href: '/application' };
    await assert.rejects(api('/api/auth/login'), { message: 'E-mail ou senha incorretos.' });
    assert.equal(global.window.location.href, '/application');
  } finally {
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
