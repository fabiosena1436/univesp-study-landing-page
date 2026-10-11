import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const config = JSON.parse(await readFile(".test-env.json", "utf8"));
const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
after(() => client.end());
async function call(path, { method = "GET", body, cookie, origin } = {}) {
  const res = await fetch(config.baseUrl + path, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cookie: res.headers.get("set-cookie")?.split(";")[0], headers: res.headers };
}
async function login(role, password = config.password) {
  const res = await call("/api/auth/login", { method: "POST", body: { email: role + "@aluno.univesp.br", password } });
  assert.equal(res.status, 200, JSON.stringify(res.data)); return res.cookie;
}
test('application integrity and account flows against PostgreSQL', async t => {
  let adminCookie, studentCookie, pendingCookie, savedId;
  await t.test('health, unauthorized access and cross-origin protections', async () => {
    assert.equal((await call('/api/health')).status, 200);
    assert.equal((await call('/api/subjects')).status, 401);
    assert.equal((await call('/api/auth/login', { method: 'POST', body: {}, origin: 'https://foreign.example' })).status, 403);
    const page = await fetch(config.baseUrl + '/app', { redirect: 'manual' }); assert.equal(page.status, 307);
  });
  await t.test('legacy snapshots and progress survive migration', async () => {
    const progress = (await client.query('SELECT * FROM study_progress WHERE user_id=$1 AND question_id=$2', [config.ids.student, config.ids.question])).rows;
    assert.equal(progress.length, 1); assert.equal(progress[0].correct_count, 2);
    const snapshot = (await client.query('SELECT snapshot FROM attempt_answers WHERE attempt_id=$1', [config.legacyAttemptId])).rows[0].snapshot;
    assert.equal(snapshot.correctKey, 'B'); assert.equal(snapshot.statement, 'Qual alternativa está correta?');
  });
  await t.test('login stores hashed sessions and migration preserves access for existing accounts', async () => {
    adminCookie = await login('admin'); studentCookie = await login('student');
    const token = studentCookie.split('=')[1];
    const stored = (await client.query('SELECT token FROM sessions WHERE user_id=$1', [config.ids.student])).rows;
    assert.ok(stored.some(s => s.token === createHash('sha256').update(token).digest('hex')));
    assert.ok(stored.every(s => s.token !== token));
    pendingCookie = await login('pending');
    assert.equal((await call('/api/auth/me', { cookie: pendingCookie })).status, 200);
  });
  await t.test('verification rejects obsolete tokens and resend requires the account session', async () => {
    const before = (await client.query('SELECT count(*)::int AS n FROM email_verification_tokens')).rows[0].n;
    assert.equal((await call('/api/auth/resend-verification', { method: 'POST', body: { email: 'pending@aluno.univesp.br' } })).status, 401);
    assert.equal((await call('/api/auth/resend-verification', { method: 'POST', cookie: pendingCookie })).status, 200);
    assert.equal((await call('/api/auth/verify-email', { method: 'POST', body: { token: 'obsolete' } })).status, 400);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM email_verification_tokens')).rows[0].n, before);
    const page = await fetch(config.baseUrl + '/confirmar-email?token=obsolete', { redirect: 'manual' });
    assert.equal(page.status, 200);
  });
  await t.test('student authorization and invalid IDs are enforced', async () => {
    assert.equal((await call('/api/subjects', { method: 'POST', cookie: studentCookie, body: { name: 'Inválida' } })).status, 403);
    assert.equal((await call('/api/parse', { method: 'POST', cookie: studentCookie, body: { text: 'abc' } })).status, 403);
    assert.equal((await call('/api/questions', { cookie: studentCookie })).status, 403);
    assert.equal((await call('/api/questions?subjectId=invalid', { cookie: adminCookie })).status, 400);
    const bankPage = await fetch(config.baseUrl + '/app/questoes', { headers: { Cookie: studentCookie }, redirect: 'manual' });
    if (bankPage.status === 307) assert.equal(bankPage.headers.get('location'), '/app');
    else { assert.equal(bankPage.status, 200); assert.match(await bankPage.text(), /NEXT_REDIRECT/); }
    assert.equal((await call('/api/attempts?offset=-1', { cookie: studentCookie })).status, 400);
  });
  await t.test('quiz excludes ungraded questions and grades forged result on server', async () => {
    const quiz = await call('/api/quiz', { method: 'POST', cookie: studentCookie, body: { subjectId: config.ids.subject, count: 10 } });
    assert.equal(quiz.status, 200); assert.ok(quiz.data.questions.length);
    const submissionId = randomUUID();
    const body = { subjectId: config.ids.subject, submissionId, answers: [{ questionId: config.ids.question, selectedKey: 'A', isCorrect: true }] };
    const responses = await Promise.all([0, 1].map(() => call('/api/attempts', { method: 'POST', cookie: studentCookie, body })));
    assert.equal(responses[0].status, 201, JSON.stringify(responses[0].data));
    assert.equal(responses[0].data.correctCount, 0); assert.equal(responses[0].data.id, responses[1].data.id); savedId = responses[0].data.id;
    assert.equal(Number((await client.query('SELECT count(*) FROM attempts WHERE submission_id=$1', [submissionId])).rows[0].count), 1);
    const duplicate = await call('/api/attempts', { method: 'POST', cookie: studentCookie, body: { ...body, submissionId: randomUUID(), answers: [...body.answers, ...body.answers] } });
    assert.equal(duplicate.status, 400);
  });
  await t.test('subject and material context, duplicate alternatives and import transaction', async () => {
    const subject = await call('/api/subjects', { method: 'POST', cookie: adminCookie, body: { name: 'Outra matéria' } });
    assert.equal(subject.status, 201);
    const material = await call('/api/materials', { method: 'POST', cookie: adminCookie, body: { subjectId: subject.data.id, text: 'Conteúdo acadêmico verificável. '.repeat(20), title: 'Material' } });
    assert.equal(material.status, 201, JSON.stringify(material.data));
    const importBody = { subjectId: config.ids.subject, materialId: material.data.id, questions: [{ statement: 'Um enunciado de teste.', options: [{ key: 'A', text: 'Um' }, { key: 'B', text: 'Dois' }], correctKey: 'A' }] };
    assert.equal((await call('/api/questions/bulk', { method: 'POST', cookie: adminCookie, body: importBody })).status, 400);
    delete importBody.materialId;
    importBody.questions.push({ ...importBody.questions[0], options: [{ key: 'A', text: 'Um' }, { key: 'A', text: 'Dois' }] });
    assert.equal((await call('/api/questions/bulk', { method: 'POST', cookie: adminCookie, body: importBody })).status, 400);
    assert.equal(Number((await client.query("SELECT count(*) FROM questions WHERE statement='Um enunciado de teste.'")).rows[0].count), 0);
  });
  await t.test('pending answers can be completed by admins and then enter quizzes', async () => {
    const subject = await call('/api/subjects', { method: 'POST', cookie: adminCookie, body: { name: 'Gabaritos pendentes', color: '#123456' } });
    assert.equal(subject.status, 201);
    const imported = await call('/api/questions/bulk', { method: 'POST', cookie: adminCookie, body: { subjectId: subject.data.id, questions: [{ statement: 'Quanto é dois somado com dois?', options: [{ key: 'A', text: 'Três' }, { key: 'B', text: 'Quatro' }], correctKey: null }] } });
    assert.equal(imported.status, 503); // Completing an unanswered question requires Gemini, intentionally disabled in this suite.
    assert.equal((await client.query('SELECT count(*)::int n FROM questions WHERE subject_id=$1',[subject.data.id])).rows[0].n,0);
    await client.query('INSERT INTO questions(user_id,subject_id,statement,options) VALUES($1,$2,$3,$4)',[config.ids.admin,subject.data.id,'Quanto é dois somado com dois?',JSON.stringify([{key:'A',text:'Três'},{key:'B',text:'Quatro'}])]);
    const listed = await call('/api/questions?subjectId=' + subject.data.id, { cookie: adminCookie });
    const id = listed.data[0].id;
    const before = await call('/api/quiz', { method: 'POST', cookie: studentCookie, body: { subjectId: subject.data.id } });
    assert.equal(before.data.questions.length, 0);
    assert.match(before.data.emptyMessage, /nenhuma tem gabarito/);
    assert.equal((await call('/api/questions/' + id, { method: 'PATCH', cookie: studentCookie, body: { correctKey: 'B' } })).status, 403);
    assert.equal((await call('/api/questions/' + id, { method: 'PATCH', cookie: adminCookie, body: { correctKey: 'F' } })).status, 400);
    const completed = await Promise.all([0, 1].map(() => call('/api/questions/' + id, { method: 'PATCH', cookie: adminCookie, body: { correctKey: 'B' } })));
    assert.deepEqual(completed.map(r => r.status).sort(), [200, 409]);
    const after = await call('/api/quiz', { method: 'POST', cookie: studentCookie, body: { subjectId: subject.data.id } });
    assert.equal(after.data.questions.length, 1); assert.equal(after.data.questions[0].correctKey, 'B');
    assert.equal((await client.query("SELECT count(*) FROM audit_events WHERE action='question.answer.complete' AND target_id=$1", [id])).rows[0].count, '1');
  });
  await t.test('only admins edit wording, preserving answers and rejecting stale edits', async () => {
    const original = (await client.query('SELECT * FROM questions WHERE id=$1', [config.ids.question])).rows[0];
    const body = { statement: 'Qual alternativa responde corretamente à pergunta?', feedback: 'A alternativa B responde corretamente.', originalStatement: original.statement, originalFeedback: original.feedback };
    const path = '/api/questions/' + config.ids.question;
    assert.equal((await call(path, { method: 'PATCH', cookie: studentCookie, body })).status, 403);
    assert.equal((await call(path, { method: 'PATCH', cookie: adminCookie, body: { ...body, correctKey: 'A' } })).status, 400);
    assert.equal((await call(path, { method: 'PATCH', cookie: adminCookie, body: { ...body, statement: 'Curto' } })).status, 400);
    const edited = await call(path, { method: 'PATCH', cookie: adminCookie, body });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.statement, body.statement);
    assert.equal(edited.data.feedback, body.feedback);
    assert.equal(edited.data.correctKey, original.correct_key);
    assert.deepEqual(edited.data.options, original.options);
    assert.equal(edited.data.id, original.id);
    assert.equal((await call(path, { method: 'PATCH', cookie: adminCookie, body })).status, 409);
    assert.equal((await client.query("SELECT count(*) FROM audit_events WHERE action='question.text.update' AND target_id=$1", [original.id])).rows[0].count, '1');
  });
  await t.test('admin manages subjects, material content and full questions with preserved snapshots', async () => {
    const subject = await call('/api/subjects', { method: 'POST', cookie: adminCookie, body: { name: 'Gestão administrativa' } });
    const subjectPath = '/api/subjects/' + subject.data.id;
    assert.equal((await call(subjectPath, { method: 'PATCH', cookie: studentCookie, body: { name: 'Negado' } })).status, 403);
    assert.equal((await call(subjectPath, { method: 'PATCH', cookie: adminCookie, body: { name: 'Matéria atualizada', color: '#123456' } })).data.name, 'Matéria atualizada');
    const material = await call('/api/materials', { method: 'POST', cookie: adminCookie, body: { subjectId: subject.data.id, title: 'Original', text: 'Conteúdo acadêmico original. '.repeat(30) } });
    const materialPath = '/api/materials/' + material.data.id;
    const detail = (await call(materialPath, { cookie: adminCookie })).data;
    const patch = { title: 'Corrigido', content: 'Conteúdo acadêmico corrigido. '.repeat(30), originalTitle: detail.title, originalContent: detail.content };
    assert.equal((await call(materialPath, { method: 'PATCH', cookie: studentCookie, body: patch })).status, 403);
    assert.equal((await call(materialPath, { method: 'PATCH', cookie: adminCookie, body: patch })).data.charCount, patch.content.trim().length);
    assert.equal((await call(materialPath, { method: 'PATCH', cookie: adminCookie, body: patch })).status, 409);
    const q = (await call('/api/questions?subjectId=' + config.ids.subject, { cookie: adminCookie })).data.find(q => q.id === config.ids.question);
    const questionPatch = { editAll: true, statement: q.statement, feedback: q.feedback, options: [{ key: 'B', text: 'Alternativa corrigida B' }, { key: 'A', text: 'Alternativa corrigida A' }], correctKey: 'A', originalStatement: q.statement, originalFeedback: q.feedback, originalOptions: q.options, originalCorrectKey: q.correctKey };
    const questionPath = '/api/questions/' + q.id;
    assert.equal((await call(questionPath, { method: 'PATCH', cookie: studentCookie, body: questionPatch })).status, 403);
    const edited = await call(questionPath, { method: 'PATCH', cookie: adminCookie, body: questionPatch });
    assert.equal(edited.status, 200); assert.equal(edited.data.correctKey, 'A'); assert.deepEqual(edited.data.options.map(o => o.key), ['A', 'B']);
    assert.equal((await call(questionPath, { method: 'PATCH', cookie: adminCookie, body: questionPatch })).status, 409);
    const snapshot = (await client.query('SELECT snapshot FROM attempt_answers WHERE attempt_id=$1', [savedId])).rows[0].snapshot;
    assert.equal(snapshot.correctKey, 'B');
    assert.equal((await call(subjectPath, { method: 'DELETE', cookie: studentCookie })).status, 403);
    assert.equal((await call(subjectPath, { method: 'DELETE', cookie: adminCookie })).status, 200);
    assert.ok(!(await call('/api/subjects', { cookie: studentCookie })).data.some(s => s.id === subject.data.id));
    assert.ok(!(await call('/api/materials', { cookie: adminCookie })).data.some(m => m.id === material.data.id));
  });
  await t.test('concurrent reviews keep one progress row and preserve counters', async () => {
    const before = (await client.query('SELECT repetitions FROM study_progress WHERE user_id=$1 AND question_id=$2', [config.ids.student, config.ids.question])).rows[0].repetitions;
    const results = await Promise.all([0, 1, 2].map(() => call('/api/study/review', { method: 'POST', cookie: studentCookie, body: { questionId: config.ids.question, rating: 'good' } })));
    assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
    const rows = (await client.query('SELECT repetitions FROM study_progress WHERE user_id=$1 AND question_id=$2', [config.ids.student, config.ids.question])).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].repetitions, before + 3);
    const plan = await call('/api/study/review', { cookie: studentCookie }); assert.equal(plan.status, 200, JSON.stringify(plan.data));
  });
  await t.test('support is atomic and only its owner or administrator reads it', async () => {
    const ticket = await call('/api/support', { method: 'POST', cookie: studentCookie, body: { subject: 'Uma dúvida', message: 'Preciso de ajuda com esta questão.' } });
    assert.equal(ticket.status, 201);
    const foreign = await call('/api/support', { cookie: pendingCookie }); assert.ok(!foreign.data.tickets.some(t => t.id === ticket.data.id));
    const reply = await call('/api/support', { method: 'PATCH', cookie: adminCookie, body: { ticketId: ticket.data.id, message: 'Resposta do administrador.' } }); assert.equal(reply.status, 200);
    const own = await call('/api/support', { cookie: studentCookie }); assert.equal(own.data.messages.length, 2);
    assert.equal((await call('/api/support', { method: 'PATCH', cookie: adminCookie, body: { ticketId: randomUUID(), message: 'Uma resposta' } })).status, 404);
  });
  await t.test('archive preserves original history and removes question from active catalog', async () => {
    assert.equal((await call('/api/questions/' + config.ids.question, { method: 'DELETE', cookie: adminCookie })).status, 200);
    const detail = await call('/api/attempts/' + savedId, { cookie: studentCookie }); assert.equal(detail.status, 200); assert.equal(detail.data.answers[0].statement, 'Qual alternativa está correta?');
    assert.equal((await call('/api/questions', { cookie: studentCookie })).status,403);
    const list = await call('/api/questions', { cookie: adminCookie }); assert.ok(!list.data.some(q => q.id === config.ids.question));
    const foreign = await call('/api/attempts/' + savedId, { cookie: pendingCookie }); assert.equal(foreign.status, 404);
    await client.query("UPDATE questions SET statement='Novo texto que não deve aparecer na prova antiga' WHERE id=$1", [config.ids.question]);
    const immutable = await call('/api/attempts/' + savedId, { cookie: studentCookie }); assert.equal(immutable.data.answers[0].statement, 'Qual alternativa está correta?');
  });
  await t.test('profile password change revokes other sessions', async () => {
    const other = await login('student');
    const changed = await call('/api/profile', { method: 'PATCH', cookie: studentCookie, body: { name: 'Aluno atualizado', course: 'Computação', currentPassword: config.password, newPassword: 'UpdatedPassword123!' } });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    studentCookie = changed.cookie; assert.ok(studentCookie);
    assert.equal((await call('/api/auth/me', { cookie: other })).status, 401);
    assert.equal((await call('/api/auth/me', { cookie: studentCookie })).status, 200);
  });
  await t.test('concurrent reset invalidates all other reset links and sessions', async () => {
    const tokens = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
    for (const token of tokens) await client.query("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [config.ids.pending, createHash('sha256').update(token).digest('hex')]);
    const results = await Promise.all(tokens.map(token => call('/api/auth/reset-password', { method: 'POST', body: { token, password: 'ResetPassword123!' } })));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal((await call('/api/auth/me', { cookie: pendingCookie })).status, 401);
    pendingCookie = await login('pending', 'ResetPassword123!');
  });
  await t.test('account export contains own data but no credentials, deletion needs password', async () => {
    const exported = await call('/api/account', { cookie: studentCookie }); assert.equal(exported.status, 200);
    assert.equal(exported.data.user.id, config.ids.student); assert.ok(!JSON.stringify(exported.data).includes('passwordHash'));
    assert.ok(exported.data.attempts.every(a => a.userId === config.ids.student));
    assert.equal((await call('/api/account', { method: 'DELETE', cookie: pendingCookie, body: { password: 'wrong', confirmation: 'EXCLUIR' } })).status, 400);
    assert.equal((await call('/api/account', { method: 'DELETE', cookie: pendingCookie, body: { password: 'ResetPassword123!', confirmation: 'EXCLUIR' } })).status, 200);
    assert.equal((await client.query('SELECT id FROM users WHERE id=$1', [config.ids.pending])).rows.length, 0);
    assert.equal((await call('/api/account', { method: 'DELETE', cookie: adminCookie, body: { password: config.password, confirmation: 'EXCLUIR' } })).status, 409);
  });
  await t.test('audit records administrative changes and shared author deletion preserves content', async () => {
    const audits = (await client.query("SELECT action FROM audit_events WHERE actor_id=$1", [config.ids.admin])).rows;
    assert.ok(audits.some(a => a.action === 'question.archive')); assert.ok(audits.some(a => a.action === 'support.reply'));
    // Test FK semantics within a rolled-back transaction to retain the browser test account.
    await client.query('BEGIN');
    try { await client.query('DELETE FROM users WHERE id=$1', [config.ids.admin]); assert.equal((await client.query('SELECT user_id FROM subjects WHERE id=$1', [config.ids.subject])).rows[0].user_id, null); }
    finally { await client.query('ROLLBACK'); }
  });
  await t.test('recovery responses stay private; new accounts need confirmation and approval', async () => {
    const known = await call('/api/auth/forgot-password', { method: 'POST', body: { email: 'student@aluno.univesp.br' } });
    const unknown = await call('/api/auth/forgot-password', { method: 'POST', body: { email: 'unknown@aluno.univesp.br' } });
    assert.equal(known.status, 200); assert.equal(unknown.status, 200); assert.deepEqual(known.data, unknown.data);
    const register = await call('/api/auth/register', { method: 'POST', body: { name: 'Novo teste', email: 'new@aluno.univesp.br', course: 'Computação', whatsapp: '(11) 99999-1234', password: config.password } });
    assert.equal(register.status, 201);
    assert.equal((await client.query("SELECT id FROM users WHERE email='new@aluno.univesp.br'")).rows.length, 1);
    assert.ok(register.cookie);
    assert.equal((await call('/api/auth/me', { cookie: register.cookie })).status, 200);
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'new@aluno.univesp.br', password: config.password } })).status, 200);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email='new@aluno.univesp.br')")).rows[0].n, 1);
    for (const path of ['/api/subjects', '/api/materials', '/api/attempts', '/api/study/review', '/api/study/flashcards', '/api/admin/access', '/api/admin/authorized-emails']) assert.equal((await call(path, { cookie: register.cookie })).status, 403, path);
    const pendingPage = await fetch(config.baseUrl + '/app', { headers: { Cookie: register.cookie }, redirect: 'manual' });
    assert.equal(pendingPage.status, 307); assert.equal(pendingPage.headers.get('location'), '/aguardando-aprovacao');
    const id = (await client.query("SELECT id FROM users WHERE email='new@aluno.univesp.br'")).rows[0].id;
    const token = randomBytes(32).toString('hex');
    await client.query('INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'1 hour\')', [id, createHash('sha256').update(token).digest('hex')]);
    const confirmations = await Promise.all([call('/api/auth/verify-email', {method:'POST',body:{token}}),call('/api/auth/verify-email', {method:'POST',body:{token}})]);
    assert.deepEqual(confirmations.map(r=>r.status).sort(), [200,400]);
    assert.equal((await call('/api/subjects', {cookie:register.cookie})).status,403);
    assert.equal((await call('/api/admin/access', {method:'PATCH',cookie:adminCookie,body:{id,status:'approved'}})).status,200);
    assert.equal((await call('/api/subjects', {cookie:register.cookie})).status,200);
    assert.equal((await call('/api/admin/access', {method:'PATCH',cookie:adminCookie,body:{id,status:'rejected'}})).status,200);
    assert.equal((await call('/api/subjects', {cookie:register.cookie})).status,403);
    assert.equal((await call('/api/admin/access', {method:'PATCH',cookie:adminCookie,body:{id:config.ids.admin,status:'rejected'}})).status,403);
  });
  await t.test('bulk allowlist grants approval but never bypasses confirmation, rejection or blocking', async () => {
    const endpoint = '/api/admin/authorized-emails';
    assert.equal((await call(endpoint, {method:'POST',cookie:studentCookie,body:{emails:'intruso@example.com'}})).status,403);
    assert.equal((await call(endpoint, {method:'POST',cookie:adminCookie,body:{emails:'valid@example.com invalido'}})).status,400);
    assert.equal((await client.query("SELECT count(*)::int n FROM authorized_emails WHERE email='valid@example.com'")).rows[0].n,0);
    const added = await call(endpoint, {method:'POST',cookie:adminCookie,body:{emails:' Allowed@ALUNO.UNIVESP.BR\nallowed@aluno.univesp.br; new@aluno.univesp.br'}});
    assert.equal(added.status,200); assert.equal(added.data.added,2);
    assert.equal((await client.query("SELECT access_status FROM users WHERE email='new@aluno.univesp.br'")).rows[0].access_status,'rejected');
    const duplicate = await call(endpoint, {method:'POST',cookie:adminCookie,body:{emails:'allowed@aluno.univesp.br'}});
    assert.deepEqual(duplicate.data,{added:0,duplicates:1});
    const body = {name:'Aluno autorizado',email:'allowed@aluno.univesp.br',course:'Computação',whatsapp:'+55 11 99999-1234',password:config.password};
    assert.equal((await call('/api/auth/register',{method:'POST',body:{...body,whatsapp:'invalid'}})).status,400);
    const registered = await call('/api/auth/register',{method:'POST',body});
    assert.equal(registered.status,201); assert.equal(registered.data.user.accessStatus,'approved'); assert.equal(registered.data.user.emailVerifiedAt,null);
    assert.equal((await call('/api/subjects',{cookie:registered.cookie})).status,403);
    const id = registered.data.user.id;
    const expired = randomBytes(32).toString('hex');
    const valid = randomBytes(32).toString('hex');
    await client.query("INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()-interval '1 second'),($1,$3,now()+interval '1 hour')",[id,createHash('sha256').update(expired).digest('hex'),createHash('sha256').update(valid).digest('hex')]);
    assert.equal((await call('/api/auth/verify-email',{method:'POST',body:{token:expired}})).status,400);
    assert.equal((await call('/api/auth/verify-email',{method:'POST',body:{token:valid}})).status,200);
    assert.equal((await call('/api/subjects',{cookie:registered.cookie})).status,200);
    assert.equal((await call(endpoint+'?email=allowed%40aluno.univesp.br',{method:'DELETE',cookie:adminCookie})).status,200);
    assert.equal((await call('/api/subjects',{cookie:registered.cookie})).status,200);
    const late = await call('/api/auth/register',{method:'POST',body:{...body,email:'late@aluno.univesp.br'}});
    assert.equal(late.data.user.accessStatus,'pending');
    await call(endpoint,{method:'POST',cookie:adminCookie,body:{emails:'late@aluno.univesp.br'}});
    assert.equal((await call('/api/auth/me',{cookie:late.cookie})).data.user.accessStatus,'approved');
    assert.equal((await call('/api/subjects',{cookie:late.cookie})).status,403);
    for (let i=0;i<3;i++) assert.equal((await call('/api/auth/resend-verification',{method:'POST',cookie:late.cookie})).status,200);
    assert.equal((await call('/api/auth/resend-verification',{method:'POST',cookie:late.cookie})).status,429);
    assert.equal((await call('/api/admin/users',{method:'PATCH',cookie:adminCookie,body:{id,blocked:true}})).status,200);
    assert.equal((await call('/api/auth/me',{cookie:registered.cookie})).status,401);
  });
  await t.test('personal email is a pending student; institutional administrator requires explicit promotion', async () => {
    const register = email => call('/api/auth/register', { method: 'POST', body: { name: 'Teste de acesso', email, course: 'Computação', whatsapp: '11999991234', password: config.password } });
    assert.equal((await register('outro@gmail.com')).status, 201);
    assert.equal((await register('fabiosena1436+teste@gmail.com')).status, 201);
    assert.equal((await register(' FABIOSENA1436@GMAIL.COM ')).status, 201);
    assert.equal((await register('fabiosena1436@gmail.com')).status, 409);
    const student = await call('/api/auth/login', { method: 'POST', body: { email: 'fabiosena1436@gmail.com', password: config.password } });
    assert.equal(student.status, 200);
    const own = await call('/api/auth/me', { cookie: student.cookie });
    assert.equal(own.status, 200); assert.equal(own.data.user.isAdmin, false);
    assert.equal((await call('/api/admin/users', { cookie: student.cookie })).status, 403);
    await client.query("UPDATE users SET is_blocked=true WHERE email='fabiosena1436@gmail.com'");
    assert.equal((await call('/api/auth/me', { cookie: student.cookie })).status, 401);
    assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'fabiosena1436@gmail.com', password: config.password } })).status, 403);
    await client.query("UPDATE users SET is_blocked=false WHERE email='fabiosena1436@gmail.com'");
    assert.equal((await register('26241463@aluno.univesp.br')).status, 201);
    const institutional = await call('/api/auth/login', { method: 'POST', body: { email: '26241463@aluno.univesp.br', password: config.password } });
    assert.equal(institutional.status, 200);
    assert.equal((await call('/api/admin/users', { cookie: institutional.cookie })).status, 403);
    const run = promisify(execFile);
    const env = { ...process.env, DATABASE_URL: config.databaseUrl };
    await assert.rejects(run(process.execPath, ['scripts/admin.mjs', 'fabiosena1436@gmail.com'], { env }));
    await run(process.execPath, ['scripts/admin.mjs', '26241463@aluno.univesp.br'], { env });
    assert.equal((await call('/api/admin/users', { cookie: institutional.cookie })).status, 200);
    assert.equal((await call('/api/admin/users', { cookie: student.cookie })).status, 403);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM email_verification_tokens WHERE user_id IN (SELECT id FROM users WHERE email IN ('26241463@aluno.univesp.br','fabiosena1436@gmail.com'))")).rows[0].n, 2);
  });
  await t.test('persistent rate limits reject the ninth login without storing email addresses as keys', async () => {
    const email = randomUUID() + '@aluno.univesp.br';
    const results = [];
    for (let i = 0; i < 9; i++) results.push(await call('/api/auth/login', { method: 'POST', body: { email, password: config.password } }));
    assert.equal(results[8].status, 429); assert.ok(results.slice(0, 8).every(r => r.status === 401));
    assert.equal((await client.query("SELECT key FROM rate_limits WHERE key LIKE '%@%'")).rows.length, 0);
  });
});
