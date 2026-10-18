const { test } = require('node:test');
const path = require('node:path');
const { build } = require('esbuild');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('artifacts/pw-browsers');
const { chromium, expect } = require('@playwright/test');

// Run the real shell, inbox, contact page and API client with simulated HTTP
// responses. No app server, credentials or application database are used.
test('student sees messages, subsequent replies, read state and announcements without reloading', async () => {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
        import AppShell from './src/components/AppShell';
        import ContatoPage from './src/app/app/contato/page';
        window.toasts = [];
        window.addEventListener('repete:toast', e => window.toasts.push(e.detail.msg));
        createRoot(document.getElementById('root')).render(<AppShell initialUser={{ id: 'student', name: 'Aluno teste', isAdmin: false }}><ContatoPage /></AppShell>);`,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{
      name: 'unrelated-ui-stubs',
      setup(builder) {
        builder.onResolve({ filter: /^next\/(link|navigation)$|^motion\/react$|\/StudyAssistant$|\/ActivityTracker$/ }, args => ({ path: args.path, namespace: 'stub' }));
        builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
          loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/link'
            ? `import React from 'react'; export default function Link(props) { return <a {...props} />; }`
            : args.path === 'next/navigation'
              ? `export const usePathname = () => '/app/contato'; export const useRouter = () => ({});`
              : args.path === 'motion/react'
                ? `export const MotionConfig = ({ children }) => children;`
                : `export const StudyAssistant = () => null; export const ActivityTracker = () => null;`,
        }));
      },
    }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let unread = 0, latestMessageAt = null, notes = [], messages = [];
    await page.route('http://notifications.test/**', async route => {
      const url = new URL(route.request().url());
      let body = [];
      if (url.pathname === '/api/support') {
        if (route.request().method() === 'PATCH') { unread = 0; latestMessageAt = null; body = { ok: true }; }
        else if (url.searchParams.has('summary')) body = { unread, latestMessageAt };
        else body = { tickets: messages.length ? [{ id: 'ticket', subject: 'Acompanhamento', status: 'answered', updatedAt: latestMessageAt || '2026-10-17T12:01:00Z', userReadAt: unread ? null : '2026-10-17T12:02:00Z' }] : [], messages };
      } else if (url.pathname === '/api/announcements') {
        if (route.request().method() === 'PATCH') { notes = notes.map(n => ({ ...n, readAt: new Date().toISOString() })); body = { ok: true }; }
        else body = notes;
      } else if (!url.pathname.startsWith('/api/')) {
        return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' });
      }
      return route.fulfill({ json: body });
    });
    await page.clock.install();
    await page.goto('http://notifications.test/app/contato');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const bell = page.getByRole('button', { name: /^Notificações:/ });
    await expect(bell).toHaveAccessibleName(/0 conversa.*0 recado/);
    await expect(page.getByText('Nenhum atendimento nesta página.')).toBeVisible();
    await bell.click();
    const dropdown = page.getByRole('region', { name: 'Suas notificações' });
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('Nenhuma mensagem recebida.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveCount(0);
    await expect(bell).toBeFocused();

    unread = 1; latestMessageAt = '2026-10-17T12:00:00Z';
    messages = [{ id: 'first', ticketId: 'ticket', senderId: 'admin', body: 'Mensagem privada do administrador.' }];
    await page.clock.fastForward(30000);
    await expect(bell).toHaveAccessibleName(/1 conversa/);
    await expect(page.getByText(messages[0].body, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.toasts.length)).toBe(1);
    await bell.click();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
    await expect(dropdown.getByText('Acompanhamento', { exact: false })).toBeVisible();
    await expect(dropdown.getByText('Administração: Mensagem privada do administrador.')).toBeVisible();
    await dropdown.getByRole('link', { name: /Abrir conversa/ }).click();
    await expect(page).toHaveURL(/#conversa-ticket$/);
    await expect(dropdown).toHaveCount(0);

    // Another message in the same unread conversation must still notify.
    latestMessageAt = '2026-10-17T12:01:00Z';
    messages.push({ id: 'second', ticketId: 'ticket', senderId: 'admin', body: 'Segunda resposta na mesma conversa.' });
    await page.getByRole('textbox', { name: 'Responder conversa: Acompanhamento' }).fill('Rascunho preservado');
    await page.clock.fastForward(30000);
    await expect(page.getByText(messages[1].body, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.toasts.length)).toBe(2);
    await expect(page.getByRole('textbox', { name: 'Responder conversa: Acompanhamento' })).toHaveValue('Rascunho preservado');
    await page.clock.fastForward(30000);
    await expect.poll(() => page.evaluate(() => window.toasts.length)).toBe(2);

    await page.getByRole('button', { name: 'Marcar conversa como lida' }).click();
    await expect(bell).toHaveAccessibleName(/0 conversa/);
    notes = [{ id: 'notice', title: 'Recado individual', body: 'Um aviso para o aluno.', createdAt: '2026-10-17T12:02:00Z', readAt: null }];
    await page.clock.fastForward(30000);
    await expect(bell).toHaveAccessibleName(/0 conversa.*1 recado/);
    await bell.click();
    await expect(dropdown.getByText('Um aviso para o aluno.', { exact: true })).toBeVisible();
    await dropdown.getByRole('link', { name: /Ler recado/ }).click();
    await expect(page).toHaveURL(/#recado-notice$/);
    await expect(page.getByRole('heading', { name: /Recado individual/ })).toBeVisible();
    await page.getByRole('button', { name: 'Marcar como lido', exact: true }).click();
    await expect(bell).toHaveAccessibleName(/0 conversa.*0 recado/);
    // A saved link must expand notices after their asynchronous initial load.
    await page.goto('http://notifications.test/app/contato#recados');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(page.getByRole('heading', { name: 'Recado individual', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
});
