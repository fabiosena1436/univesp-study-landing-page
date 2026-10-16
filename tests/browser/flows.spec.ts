import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
const config = JSON.parse(readFileSync(".test-env.json", "utf8")) as { databaseUrl: string; password: string; baseUrl: string };

async function signIn(page: Page, email: string, password = config.password) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/(app|aguardando-aprovacao)$/);
}
async function subject(page: Page) {
  const response = await page.request.post("/api/subjects", { data: { name: `Navegador ${randomUUID().slice(0, 8)}` } });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}

test("login permite mostrar/ocultar senha e cadastro institucional mantém a conta pendente", async ({ page }) => {
  await page.goto("/entrar");
  const password = page.getByLabel("Senha", { exact: true });
  await password.fill(config.password);
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Aluno navegador");
  await page.getByLabel("E-mail institucional da UNIVESP").fill("aluno@gmail.com");
  await page.getByLabel("Curso", { exact: true }).fill("Computação");
  await page.getByLabel("Senha", { exact: true }).fill(config.password);
  await page.getByLabel("Confirmar senha").fill(config.password);
  await page.getByLabel("WhatsApp com DDD").fill("11999991234");
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await expect(page.getByText("Use seu e-mail institucional da UNIVESP com final @aluno.univesp.br.")).toBeVisible();
  await page.getByLabel("E-mail institucional da UNIVESP").fill(`browser-${randomUUID()}@aluno.univesp.br`);
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await expect(page).toHaveURL(/aguardando-aprovacao$/);
  await expect(page.getByText("Confirmação do e-mail", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Minha conta: dados, senha e exclusão" }).click();
  await expect(page.getByRole("heading", { name: "Minha conta", exact: true })).toBeVisible();
  const response = await page.request.get("/api/account");
  expect(response.status()).toBe(200);
  expect((await page.request.get("/api/subjects")).status()).toBe(403);
});

test("administrador aprova e concede assistente pela interface; assistente não pode excluir", async ({ page, browser }) => {
  await signIn(page, "admin@aluno.univesp.br");
  const email = `assistant-browser-${randomUUID()}@aluno.univesp.br`;
  const registration = await page.request.post("/api/auth/register", { data: { name: "Assistente navegador", email, password: config.password, course: "Computação", whatsapp: "11999991234" } });
  expect(registration.status()).toBe(201);
  // Registration creates a student session, so reauthenticate the administrator.
  await signIn(page, "admin@aluno.univesp.br");
  await page.goto("/app/admin");
  const approval = page.getByRole("heading", { name: "Aprovação de acesso" }).locator("..");
  await approval.locator("div.border-b").filter({ hasText: email }).getByRole("button", { name: "Aprovar", exact: true }).click();
  const accounts = page.getByRole("heading", { name: "Usuários cadastrados" }).locator("..");
  const grant = accounts.locator("div.border-b").filter({ hasText: email }).getByRole("button", { name: "Tornar assistente" });
  await expect(grant).toBeEnabled();
  await grant.click();
  const context = await browser.newContext({ baseURL: config.baseUrl });
  try {
    const assistant = await context.newPage();
    await signIn(assistant, email);
    await assistant.goto("/app/materiais");
    await expect(assistant.getByRole("button", { name: "Buscar PDF", exact: true }).first()).toBeVisible();
    await expect(assistant.getByRole("link", { name: "Administração", exact: true })).toHaveCount(0);
    expect((await assistant.request.get("/api/admin/users")).status()).toBe(403);
    expect((await assistant.request.delete(`/api/subjects/${randomUUID()}`)).status()).toBe(403);
  } finally { await context.close(); }
});

test("PDF de 3 MB é anexado, separado do texto e acessível ao aluno", async ({ page }) => {
  await signIn(page, "admin@aluno.univesp.br");
  const sid = await subject(page);
  const title = `Anexo do navegador ${randomUUID().slice(0, 8)}`;
  const materialResponse = await page.request.post("/api/materials", { data: { subjectId: sid, title, text: "Conteúdo de aula disponível para leitura. ".repeat(30) } });
  expect(materialResponse.status()).toBe(201);
  const material = await materialResponse.json();
  await page.goto("/app/materiais");
  await page.locator("div.flex.items-center.gap-4").filter({ hasText: title }).getByRole("button", { name: "Gerar questões", exact: true }).click();
  const { testPdf } = await import("../helpers/pdf.mjs");
  const file = testPdf(3 * 1024 * 1024);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Buscar PDF", exact: true }).last().click()]);
  await chooser.setFiles({ name: "aula-navegador.pdf", mimeType: "application/pdf", buffer: file });
  await expect(page.getByText("aula-navegador.pdf", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar anexo PDF", exact: true }).click();
  await expect(page.getByText("PDF anexado. Os alunos já podem visualizar o arquivo.")).toBeVisible();
  await signIn(page, "student@aluno.univesp.br");
  await page.goto("/app/materiais");
  await expect(page.getByRole("region", { name: "PDFs originais" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Materiais em texto" })).toBeVisible();
  await page.getByRole("region", { name: "PDFs originais" }).getByRole("button", { name: `Abrir PDF: ${title}` }).click();
  await expect(page.locator(`iframe[title="PDF: ${title}"]`)).toBeVisible();
  const pdf = await page.request.get(`/api/materials/${material.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(await pdf.body()).toEqual(file);
  await page.getByRole("button", { name: "Ler a versão em texto" }).click();
  await expect(page.locator("article")).toContainText("Conteúdo de aula disponível para leitura.");
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const assistant = page.getByRole("dialog", { name: "Assistente de estudos" });
  await expect(assistant).toBeVisible();
  await expect(assistant.getByRole("button", { name: "Resuma os pontos principais" })).toBeVisible();
  await assistant.getByLabel("Sua pergunta para o assistente").fill("Explique este material");
  await assistant.getByRole("button", { name: "Enviar pergunta" }).click();
  await expect(assistant.getByRole("alert")).toContainText("indisponível");
  await assistant.getByRole("button", { name: "Fechar assistente" }).click();
  await expect(assistant).not.toBeVisible();
});

test("materiais filtram por matéria antes da paginação e preservam a seleção ao voltar da leitura", async ({ page }) => {
  const database = new URL(config.databaseUrl);
  if (!database.pathname.startsWith("/aprova_test")) throw new Error("Este teste exige um banco isolado.");
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  const firstId = randomUUID(), secondId = randomUUID(), emptyId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const firstName = `Álgebra ${suffix}`, secondName = `Biologia ${suffix}`, emptyName = `Química ${suffix}`;
  try {
    await client.query("INSERT INTO subjects(id,name) VALUES ($1,$2),($3,$4),($5,$6)", [firstId, firstName, secondId, secondName, emptyId, emptyName]);
    // A matéria antiga só aparece após a primeira página do catálogo sem filtro.
    await client.query("INSERT INTO materials(subject_id,title,filename,content,char_count,created_at) SELECT $1,'Revisão de álgebra ' || n,'texto.txt',repeat('Conteúdo de álgebra. ',30),600,now() - interval '1 day' FROM generate_series(1,51) n", [firstId]);
    await client.query("INSERT INTO materials(subject_id,title,filename,content,char_count) SELECT $1,'Revisão de biologia ' || n,'texto.txt',repeat('Conteúdo de biologia. ',30),600 FROM generate_series(1,51) n", [secondId]);
    await signIn(page, "student@aluno.univesp.br");
    await page.goto("/app/materiais");
    const filter = page.getByLabel("Filtrar por matéria", { exact: true });
    const texts = page.getByRole("region", { name: "Materiais em texto", exact: true });
    await expect(texts.getByRole("heading", { name: /^Revisão de álgebra/ })).toHaveCount(0);
    await filter.selectOption(firstId);
    await expect(texts.getByRole("heading", { name: /^Revisão de álgebra/ })).toHaveCount(50);
    await expect(texts.getByRole("heading", { name: /^Revisão de biologia/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
    await expect(texts.getByRole("heading", { name: /^Revisão de álgebra/ })).toHaveCount(1);
    await texts.getByRole("button", { name: /^Ler texto:/ }).click();
    await expect(page.locator("article")).toContainText("Conteúdo de álgebra.");
    await page.getByRole("button", { name: "Voltar aos materiais" }).click();
    await expect(filter).toHaveValue(firstId);
    await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
    await filter.selectOption(secondId);
    await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
    await expect(texts.getByRole("heading", { name: /^Revisão de biologia/ })).toHaveCount(50);
    await filter.selectOption(emptyId);
    await expect(page.getByText("Nenhum material nesta matéria", { exact: true })).toBeVisible();
    await filter.selectOption("");
    await expect(texts.getByRole("heading", { name: secondName, exact: false })).toBeVisible();
    expect((await page.request.get("/api/materials?subjectId=invalid")).status()).toBe(400);
    const response = await page.request.get(`/api/materials?subjectId=${firstId}&offset=50`);
    expect(response.status()).toBe(200);
    const rows = await response.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].subjectId).toBe(firstId);
    await page.setViewportSize({ width: 390, height: 844 });
    await filter.selectOption(firstId);
    await expect(texts.getByRole("heading", { name: /^Revisão de álgebra/ })).toHaveCount(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }))).toEqual([]);
    await signIn(page, "admin@aluno.univesp.br");
    await page.goto("/app/materiais");
    await page.getByLabel("Filtrar materiais por matéria").selectOption(firstId);
    await expect(page.getByText(/^Revisão de álgebra/)).toHaveCount(50);
    await expect(page.getByText(/^Revisão de biologia/)).toHaveCount(0);
  } finally {
    await client.query("DELETE FROM materials WHERE subject_id = ANY($1::uuid[])", [[firstId, secondId, emptyId]]);
    await client.query("DELETE FROM subjects WHERE id = ANY($1::uuid[])", [[firstId, secondId, emptyId]]);
    await client.end();
  }
});

test("prova é respondida e salva pelo navegador", async ({ page }) => {
  await signIn(page, "admin@aluno.univesp.br");
  const sid = await subject(page);
  const saved = await page.request.post("/api/questions/bulk", { data: { subjectId: sid, questions: [{ statement: "Qual é o resultado de dois mais dois?", options: [{ key: "A", text: "Três" }, { key: "B", text: "Quatro" }], correctKey: "B", feedback: "Dois mais dois são quatro." }] } });
  expect(saved.status()).toBe(201);
  await signIn(page, "student@aluno.univesp.br");
  await page.goto(`/app/prova?m=${sid}`);
  await page.getByRole("button", { name: "Começar prova" }).click();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const assistant = page.getByRole("dialog", { name: "Assistente de estudos" });
  await expect(assistant.getByRole("button", { name: "Dê uma dica sem revelar a resposta" })).toBeVisible();
  await assistant.getByRole("button", { name: "Fechar assistente" }).click();
  await page.getByText("Quatro", { exact: true }).click();
  await page.getByRole("button", { name: "Verificar resposta" }).click();
  await page.getByRole("button", { name: "Finalizar prova" }).click();
  await expect(page.getByText("Prova salva: 1 acertos.")).toBeVisible();
  const history = await page.request.get("/api/attempts");
  expect((await history.json())[0].correctCount).toBe(1);
});

test("painel mostra total acima de 100 e tela funciona no celular sem falhas axe", async ({ page }) => {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    const [user] = (await client.query("SELECT id FROM users WHERE email='student@aluno.univesp.br'")).rows;
    const [s] = (await client.query("SELECT id,name FROM subjects WHERE archived_at IS NULL LIMIT 1")).rows;
    await client.query("INSERT INTO attempts(user_id,subject_id,subject_name,submission_id,total,correct_count) SELECT $1,$2,$3,gen_random_uuid(),1,1 FROM generate_series(1,150)", [user.id, s.id, s.name]);
  } finally { await client.end(); }
  await signIn(page, "student@aluno.univesp.br");
  await expect(page.getByRole("button", { name: "Abrir assistente de IA" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir assistente de IA" }).click();
  const assistant = page.getByRole("dialog", { name: "Assistente de estudos" });
  await expect(assistant.getByLabel("Matéria para esta conversa")).toBeVisible();
  const assistantAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(assistantAccessibility.violations.map(v => v.id)).toEqual([]);
  await assistant.getByRole("button", { name: "Fechar assistente" }).click();
  await page.goto("/app/plano");
  await expect(page.getByRole("button", { name: "Abrir assistente de IA" })).toBeVisible();
  await page.goto("/app");
  const response = await page.request.get("/api/dashboard");
  const dashboard = await response.json();
  expect(dashboard.totalAttempts).toBeGreaterThan(150);
  const metric = page.getByText("Provas feitas", { exact: true }).locator("..");
  await expect(metric).toContainText(String(dashboard.totalAttempts));
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const launcher = page.getByRole("button", { name: "Abrir assistente de IA" });
    await expect(launcher).toBeInViewport();
    await page.screenshot({ path: `artifacts/mobile-dashboard-${width}.png`, fullPage: true });
  }
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

for (const width of [320, 390, 768]) {
  test(`prova no celular ${width}px posiciona assistente conforme a atividade`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await signIn(page, "admin@aluno.univesp.br");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sid = await subject(page);
    const saved = await page.request.post("/api/questions/bulk", { data: { subjectId: sid, questions: [{ statement: "Qual é o resultado de dois mais dois?", options: [{ key: "A", text: "Três" }, { key: "B", text: "Quatro" }], correctKey: "B", feedback: "Dois mais dois são quatro." }] } });
    expect(saved.status()).toBe(201);
    await signIn(page, "student@aluno.univesp.br");
    await page.goto(`/app/prova?m=${sid}`);
    const launch = page.getByRole("button", { name: "Abrir assistente de IA" });
    await expect(launch).toHaveCSS("position", "fixed");
    await expect.poll(async () => (await launch.boundingBox())?.y ?? 0).toBeGreaterThan(370);
    await page.getByRole("button", { name: "Começar prova" }).click();
    await expect(launch).toHaveCSS("position", width < 640 ? "static" : "fixed");
    if (width < 640) await expect.poll(async () => (await launch.boundingBox())?.y ?? 1000).toBeLessThan(80);
    else await expect.poll(async () => (await launch.boundingBox())?.y ?? 0).toBeGreaterThan(370);
    await launch.click();
    const dialog = page.getByRole("dialog", { name: "Assistente de estudos" });
    await expect(dialog).toBeInViewport();
    await dialog.getByRole("button", { name: "Fechar assistente" }).click();
    await page.getByText("Quatro", { exact: true }).click();
    const check = page.getByRole("button", { name: "Verificar resposta" });
    await check.scrollIntoViewIfNeeded();
    await expect(check).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sendBox = await check.boundingBox(), launchBox = await launch.boundingBox();
    if (width < 640) expect(sendBox && launchBox && (sendBox.y >= launchBox.y + launchBox.height || sendBox.y + sendBox.height <= launchBox.y || sendBox.x >= launchBox.x + launchBox.width || sendBox.x + sendBox.width <= launchBox.x)).toBeTruthy();
    await page.screenshot({ path: `artifacts/mobile-quiz-${width}.png`, fullPage: true });
    await check.click();
    await page.getByRole("button", { name: "Finalizar prova" }).click();
    await expect(page.getByText("Prova salva: 1 acertos.")).toBeVisible();
    await expect(launch).toHaveCSS("position", "fixed");
  });
}

test.describe("posição personalizada do assistente", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("mouse, toque e teclado movem sem abrir o chat; posição pode ser restaurada", async ({ page, context }) => {
    await signIn(page, "student@aluno.univesp.br");
    const launch = page.getByRole("button", { name: "Abrir assistente de IA" });
    await expect(launch).toBeVisible();
    const before = (await launch.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(35, 330, { steps: 12 });
    await page.mouse.up();
    const dialog = page.getByRole("dialog", { name: "Assistente de estudos" });
    await expect(dialog).not.toBeVisible();
    await expect.poll(async () => (await launch.boundingBox())?.y ?? 1000).toBeLessThan(400);
    await page.reload();
    await expect.poll(async () => (await launch.boundingBox())?.y ?? 1000).toBeLessThan(400);
    const saved = (await launch.boundingBox())!;
    await launch.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect.poll(async () => (await launch.boundingBox())?.x ?? 0).toBeGreaterThan(saved.x + 10);
    const moved = (await launch.boundingBox())!;
    const touch = await context.newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 500, y: 5 }] });
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(dialog).not.toBeVisible();
    const clamped = (await launch.boundingBox())!;
    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(390);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
    await launch.tap();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Restaurar posição do assistente" }).click();
    await dialog.getByRole("button", { name: "Fechar assistente" }).click();
    await expect.poll(async () => (await launch.boundingBox())?.y ?? 0).toBeGreaterThan(700);
  });
});

test("administração mostra consumo Gemini e Groq separados também no celular", async ({ page }) => {
  const database = new URL(config.databaseUrl);
  if (!database.pathname.startsWith('/aprova_test')) throw new Error('Este teste exige um banco isolado.');
  const client = new pg.Client({ connectionString: config.databaseUrl });
  const ids = [randomUUID(), randomUUID()];
  await client.connect();
  try {
    for (const [index, provider] of ['gemini', 'groq'].entries()) {
      const event = { provider, model: `ui-${provider}-usage`, status: 200, tokens: { input: 10, output: 5, thinking: 0, total: 15 }, message: null, retryAfter: null };
      await client.query('INSERT INTO audit_events(id,action,target_id) VALUES($1,$2,$3)', [ids[index], `${provider}.request`, JSON.stringify(event)]);
    }
    await signIn(page, 'admin@aluno.univesp.br');
    await page.goto('/app/admin');
    const gemini = page.getByRole('region', { name: 'Gemini · Geração de questões', exact: true });
    const groq = page.getByRole('region', { name: 'Groq · Assistente de estudos', exact: true });
    await expect(gemini).toBeVisible(); await expect(groq).toBeVisible();
    await expect(gemini).toContainText('Chave Gemini não configurada');
    await expect(groq).toContainText('Chave Groq não configurada');
    const response = await page.request.get('/api/admin/ai-usage');
    expect(response.status()).toBe(200);
    const usage = await response.json();
    for (const [provider, region] of [['gemini', gemini], ['groq', groq]] as const) {
      const period = usage.providers.find((item: { provider: string }) => item.provider === provider).today;
      await expect(region.locator('tbody tr').first().locator('td').last()).toHaveText(period.total.toLocaleString('pt-BR'));
    }
    await groq.getByText('Últimas chamadas Groq', { exact: true }).click();
    await expect(groq).toContainText('ui-groq-usage');
    await expect(groq).not.toContainText('ui-gemini-usage');
    await groq.getByText('Últimas chamadas Groq', { exact: true }).click();
    await page.setViewportSize({ width: 320, height: 740 });
    await groq.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/mobile-ai-providers.png', fullPage: true });
  } finally {
    await client.query('DELETE FROM audit_events WHERE id=ANY($1::uuid[])', [ids]);
    await client.end();
  }
});
