const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID, webcrypto } = require('node:crypto');

test('community management enforces ownership against isolated PostgreSQL', async t => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const pg = new PGlite();
  const db = drizzle(pg);
  const schema = require('../../.test-build/db/schema');
  const errors = require('../../.test-build/lib/errors');
  const admin = { id: randomUUID(), isAdmin: true }, alice = { id: randomUUID(), isAdmin: false }, bob = { id: randomUUID(), isAdmin: false };
  let current = admin;
  const modules = {
    '@/db': { db }, '@/db/schema': schema, 'next/server': {},
    '@/lib/auth': {
      requireUser: async () => { if (!current) throw new errors.ApiError(401, 'Entre'); return current; },
      requireAdmin: async () => { if (!current?.isAdmin) throw new errors.ApiError(403, 'Restrito'); return current; },
      requireContentManager: async () => { if (!current?.isAdmin) throw new errors.ApiError(403, 'Restrito'); return current; },
    },
    '@/lib/errors': errors, '@/lib/validation': require('../../.test-build/lib/validation'),
    '@/lib/rateLimit': { rateLimit: async () => {} },
    '@/lib/audit': { audit: async (actorId, action, targetId, tx = db) => { await tx.insert(schema.auditEvents).values({ actorId, action, targetId }); } },
    '@/server/services/telemetry': { instrument: (_route, _method, handler) => handler },
  };
  function load(path) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => name in modules ? modules[name] : require(name), Response, Request, File, Buffer, process, crypto: webcrypto, console });
    return exports;
  }
  const request = (body, query = '') => ({ json: async () => body, nextUrl: new URL('http://localhost/api/test' + query) });
  try {
    await pg.exec("SET TIME ZONE 'UTC'");
    for (const name of fs.readdirSync('migrations').filter(name => name.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync('migrations/' + name, 'utf8'));
    for (const [name, user] of [['admin', admin], ['alice', alice], ['bob', bob]]) await db.insert(schema.users).values({ id: user.id, name, email: name + '@example.invalid', passwordHash: 'test-only', accessStatus: 'approved' });
    const support = load('src/app/api/support/route.ts');
    const notices = load('src/app/api/announcements/route.ts');
    modules['@/lib/contentNotice'] = load('src/lib/contentNotice.ts');
    modules['@/lib/fingerprint'] = load('src/lib/fingerprint.ts');
    modules['@/lib/aiOperation'] = { withAiOperation: (_id, _signal, work) => work() };
    modules['@/lib/ai'] = { completeQuestionAnswers: async input => input };
    modules['@/lib/pdfValidation'] = { PDF_REQUEST_MAX_BYTES: 5 * 1024 * 1024 };
    modules['@/lib/pdf'] = { cleanExtractedText: text => text, pdfValidationError: () => null, extractPdfText: async () => ({ text: 'Conteúdo PDF. '.repeat(50), pages: 1 }) };

    await t.test('publishing material, PDF and question batches creates atomic unread notices with individual receipts', async () => {
      current = admin;
      const [subject] = await db.insert(schema.subjects).values({ userId: admin.id, name: 'Matemática' }).returning();
      const materialRoute = load('src/app/api/materials/route.ts');
      const bulkRoute = load('src/app/api/questions/bulk/route.ts');
      const jsonRequest = body => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const material = await materialRoute.POST(jsonRequest({ subjectId: subject.id, title: 'Aula de frações', text: 'Explicação de frações. '.repeat(50) }));
      assert.equal(material.status, 201);
      const form = new FormData();
      form.set('subjectId', subject.id); form.set('title', 'PDF da aula');
      form.set('file', new File(['%PDF-test-only'], 'aula.pdf', { type: 'application/pdf' }));
      assert.equal((await materialRoute.POST(new Request('http://localhost/api/test', { method: 'POST', body: form }))).status, 201);
      const questions = [{ statement: 'Qual é a soma de dois e dois?', options: [{ key: 'A', text: 'Quatro' }, { key: 'B', text: 'Cinco' }], correctKey: 'A' }];
      const imported = await bulkRoute.POST(jsonRequest({ subjectId: subject.id, questions, skipDuplicates: true }));
      assert.equal(imported.status, 201);
      assert.equal((await imported.json()).inserted, 1);
      const repeated = await bulkRoute.POST(jsonRequest({ subjectId: subject.id, questions, skipDuplicates: true }));
      assert.equal((await repeated.json()).inserted, 0);
      assert.equal((await materialRoute.POST(jsonRequest({ subjectId: subject.id, text: 'Curto' }))).status, 422);
      let published = await db.select().from(schema.announcements);
      assert.equal(published.length, 3); // No duplicate-only or failed-upload notices.
      assert.deepEqual(new Set(published.map(n => n.title)), new Set(['Novo material disponível', 'Novo PDF disponível', 'Novas questões disponíveis']));
      // The notification must roll back together with a failed content transaction.
      await assert.rejects(db.transaction(async tx => { await modules['@/lib/contentNotice'].contentNotice(tx, admin.id, 'Rollback', 'Não deve aparecer'); throw Error('rollback'); }));
      assert.equal((await db.select().from(schema.announcements)).length, 3);
      current = alice;
      const inbox = await (await notices.GET(request(null, '?unread=1'))).json();
      assert.equal(inbox.length, 3);
      assert.equal((await notices.PATCH(request({ id: inbox[0].id, read: true }))).status, 200);
      assert.equal((await (await notices.GET(request(null, '?unread=1'))).json()).length, 2);
      assert.equal((await (await notices.GET(request(null))).json()).length, 3); // History is preserved.
      current = bob;
      assert.equal((await (await notices.GET(request(null, '?unread=1'))).json()).length, 3);
      current = admin;
      // Keep unrelated announcement tests independent of these fixtures.
      await db.delete(schema.announcements);
    });

    await t.test('admin starts a private conversation, its owner replies, others cannot read or reply', async () => {
      current = admin;
      const sent = await support.POST(request({ userId: alice.id, subject: 'Acompanhamento', message: 'Como estão seus estudos?' }));
      assert.equal(sent.status, 201);
      const { id: ticketId } = await sent.json();
      current = bob;
      assert.equal((await (await support.GET(request(null))).json()).tickets.length, 0);
      assert.equal((await support.PATCH(request({ ticketId, message: 'Invasão de conversa' }))).status, 404);
      assert.equal((await support.POST(request({ userId: alice.id, subject: 'Forjado', message: 'Conteúdo forjado' }))).status, 403);
      current = alice;
      const inbox = await (await support.GET(request(null))).json();
      const firstSummary = await (await support.GET(request(null, '?summary=1'))).json();
      assert.equal(firstSummary.unread, 1);
      assert.ok(firstSummary.latestMessageAt);
      current = bob;
      const otherSummary = await (await support.GET(request(null, '?summary=1'))).json();
      assert.equal(otherSummary.unread, 0);
      assert.equal(otherSummary.latestMessageAt, null);
      current = admin;
      await pg.query("UPDATE support_tickets SET updated_at='2026-01-01' WHERE id=$1", [ticketId]);
      current = alice;
      const beforeReply = await (await support.GET(request(null, '?summary=1'))).json();
      current = admin;
      assert.equal((await support.PATCH(request({ ticketId, message: 'Uma nova mensagem na mesma conversa.' }))).status, 200);
      current = alice;
      const afterReply = await (await support.GET(request(null, '?summary=1'))).json();
      assert.equal(afterReply.unread, beforeReply.unread);
      assert.ok(Date.parse(afterReply.latestMessageAt) > Date.parse(beforeReply.latestMessageAt));
      assert.equal(inbox.tickets[0].userReadAt, null);
      assert.equal(inbox.messages[0].senderId, admin.id);
      // Reading an older on-screen version cannot acknowledge a concurrent reply.
      assert.equal((await support.PATCH(request({ ticketId, read: true, viewedAt: beforeReply.latestMessageAt }))).status, 200);
      assert.equal((await (await support.GET(request(null, '?unread=1'))).json()).tickets.length, 1);
      assert.equal((await support.PATCH(request({ ticketId, read: true }))).status, 200);
      const readSummary = await (await support.GET(request(null, '?summary=1'))).json();
      assert.equal(readSummary.unread, 0);
      assert.equal(readSummary.latestMessageAt, null);
      assert.equal((await (await support.GET(request(null, '?unread=1'))).json()).tickets.length, 0);
      assert.equal((await (await support.GET(request(null))).json()).tickets.length, 1);
      assert.equal((await support.PATCH(request({ ticketId, message: 'Estou revisando matemática.' }))).status, 200);
      current = admin;
      const reply = await (await support.GET(request(null))).json();
      assert.equal(reply.messages.length, 3);
      assert.equal(reply.tickets[0].adminReadAt, null);
    });

    await t.test('admin notifications count registrations and unread conversations without exposing message text', async () => {
      const notifications = load('src/app/api/admin/notifications/route.ts');
      current = bob;
      assert.equal((await notifications.GET(request(null))).status, 403);
      current = admin;
      await db.insert(schema.admins).values({ userId: admin.id });
      await pg.query("UPDATE users SET created_at='2025-01-01', access_status='pending' WHERE id=$1", [alice.id]);
      await pg.query("UPDATE users SET created_at='2026-02-01 00:00:00.123456', access_status='approved' WHERE id=$1", [bob.id]);
      const first = await notifications.GET(request(null));
      assert.equal(first.headers.get('Cache-Control'), 'no-store');
      const initial = await first.json();
      assert.equal(initial.registrations, 1);
      assert.equal(initial.pending, 1);
      assert.equal(initial.unread, 1);
      assert.ok(initial.latestMessageAt);
      assert.doesNotMatch(JSON.stringify(initial), /example.invalid|revisando|password/);
      const newer = await (await notifications.GET(request(null, '?since=2026-01-01T00:00:00.000Z'))).json();
      assert.equal(newer.registrations, 1); // Includes the automatically approved new account.
      assert.equal(newer.latestRegistrationAt, '2026-02-01T00:00:00.123Z');
      const seen = await (await notifications.GET(request(null, '?since=' + encodeURIComponent(newer.latestRegistrationAt)))).json();
      assert.equal(seen.registrations, 0);
      assert.equal((await notifications.GET(request(null, '?since=invalid'))).status, 400);
      const inbox = await (await support.GET(request(null))).json();
      await support.PATCH(request({ ticketId: inbox.tickets[0].id, read: true }));
      assert.equal((await (await notifications.GET(request(null))).json()).unread, 0);
      await pg.query("UPDATE users SET access_status='approved' WHERE id=$1", [alice.id]);
    });

    await t.test('general and targeted announcements keep audience boundaries and read receipts', async () => {
      current = admin;
      const everyone = await notices.POST(request({ title: 'Novos materiais', body: 'Confira os materiais publicados.' }));
      const direct = await notices.POST(request({ title: 'Recado individual', body: 'Continue sua revisão.', recipientId: alice.id }));
      assert.equal(everyone.status, 201); assert.equal(direct.status, 201);
      const { id } = await direct.json();
      current = bob;
      assert.equal((await (await notices.GET(request(null))).json()).length, 1);
      assert.equal((await notices.PATCH(request({ id, read: true }))).status, 404);
      assert.equal((await notices.GET(request(null, '?manage=1'))).status, 403);
      assert.equal((await notices.POST(request({ title: 'Não permitido', body: 'Outro recado.' }))).status, 403);
      current = alice;
      assert.equal((await (await notices.GET(request(null))).json()).length, 2);
      assert.equal((await notices.PATCH(request({ id, read: true }))).status, 200);
      assert.equal((await notices.PATCH(request({ id, read: true }))).status, 200);
      assert.equal((await db.select().from(schema.announcementReads)).length, 1);
      current = admin;
      assert.equal((await notices.PATCH(request({ id, active: false }))).status, 200);
      current = alice;
      assert.equal((await (await notices.GET(request(null))).json()).length, 1);
    });

    await t.test('AI usage separates Groq from legacy Gemini logs, including zero usage and independent recent calls', async () => {
      const names = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'GEMINI_MODELS', 'GROQ_TUTOR_MODEL'];
      const saved = names.map(name => process.env[name]);
      try {
        process.env.GEMINI_API_KEY = 'test-only-key';
        delete process.env.GROQ_API_KEY;
        process.env.GEMINI_MODELS = 'gemini-test';
        process.env.GROQ_TUTOR_MODEL = 'groq-test';
        modules['./aiUsage'] = require('../../.test-build/lib/aiUsage');
        modules['./aiOperation'] = require('../../.test-build/lib/aiOperation');
        modules['./rateLimit'] = { rateLimit: async () => {} };
        const store = load('src/lib/aiUsageStore.ts');
        const empty = await store.readAiUsage();
        assert.equal(empty.providers.length, 2);
        assert.equal(empty.providers.find(p => p.provider === 'groq').today.total, 0);
        assert.equal(empty.providers.find(p => p.provider === 'groq').startedAt, null);
        const log = async (action, event, yesterday = false) => pg.query(`INSERT INTO audit_events(action,target_id,created_at) VALUES($1,$2,${yesterday ? "(((now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo') - interval '1 microsecond') AT TIME ZONE 'UTC'" : "now() AT TIME ZONE 'UTC'"})`, [action, JSON.stringify(event)]);
        for (let index = 0; index < 12; index++) await log('gemini.request', { model: 'old-gemini', status: 200, tokens: { input: 10, output: 20, thinking: 1, total: 100 }, message: null, retryAfter: null });
        await log('groq.request', { provider: 'groq', model: 'groq-test', status: 200, tokens: { input: 30, output: 15, thinking: 5, total: 50 } });
        await log('groq.request', { provider: 'groq', model: 'groq-test', status: 200, tokens: { input: null, output: null, thinking: null, total: null } });
        await log('groq.request', { provider: 'groq', model: 'groq-test', status: 429, tokens: { input: null, output: null, thinking: null, total: null } });
        await log('groq.request', { provider: 'groq', model: 'groq-test', status: 200, tokens: { input: 40, output: 25, thinking: 5, total: 70 } }, true);
        const result = await store.readAiUsage();
        const gemini = result.providers.find(p => p.provider === 'gemini'), groq = result.providers.find(p => p.provider === 'groq');
        assert.equal(gemini.configured, true); assert.equal(groq.configured, false);
        assert.equal(gemini.today.calls, 12); assert.equal(gemini.today.total, 1200);
        assert.equal(groq.today.calls, 3); assert.equal(groq.today.failures, 1);
        assert.equal(groq.today.unreported, 1); assert.equal(groq.today.total, 50);
        assert.equal(result.today.total, 1250);
        assert.equal(result.today.calls, gemini.today.calls + groq.today.calls);
        assert.equal(gemini.recent.length, 10); assert.equal(groq.recent.length, 4);
        assert.ok(gemini.recent.every(event => event.provider === 'gemini'));
        assert.ok(groq.recent.every(event => event.provider === 'groq'));
        assert.ok(groq.startedAt);
        assert.equal(result.recent.length, 10);
      } finally {
        names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
      }
    });

    await t.test('admin-only details expose study metrics, not password hashes; activity does not count idle gaps', async () => {
      const detail = load('src/app/api/admin/users/[id]/route.ts');
      current = bob;
      assert.equal((await detail.GET(new Request('http://localhost'), { params: Promise.resolve({ id: alice.id }) })).status, 403);
      current = admin;
      const response = await detail.GET(new Request('http://localhost'), { params: Promise.resolve({ id: alice.id }) });
      assert.equal(response.status, 200);
      const record = await response.json();
      assert.equal(record.summary.attempts, 0);
      assert.equal(record.user.activeSeconds, 0);
      assert.equal(record.user.activityStartedAt, null);
      assert.doesNotMatch(JSON.stringify(record), /passwordHash|password_hash|test-only/);
      const pulse = load('src/app/api/activity/route.ts');
      current = alice;
      assert.equal((await pulse.POST()).status, 200);
      assert.equal((await db.select().from(schema.users)).find(u => u.id === alice.id).activeSeconds, 0);
      await pg.query("UPDATE users SET last_seen_at=now()-interval '60 seconds' WHERE id=$1", [alice.id]);
      await pulse.POST();
      assert.ok((await db.select().from(schema.users)).find(u => u.id === alice.id).activeSeconds >= 59);
      await pg.query("UPDATE users SET last_seen_at=now()-interval '1 hour' WHERE id=$1", [alice.id]);
      const before = (await db.select().from(schema.users)).find(u => u.id === alice.id).activeSeconds;
      await pulse.POST();
      assert.equal((await db.select().from(schema.users)).find(u => u.id === alice.id).activeSeconds, before);
    });
  } finally {
    await pg.close();
  }
});
