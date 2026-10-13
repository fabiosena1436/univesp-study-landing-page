import { writeFile, mkdir } from "node:fs/promises";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { withTestRuntime } from "./test-runtime.mjs";

await withTestRuntime(async config => {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  try {
    const sid = randomUUID();
    await client.query("INSERT INTO subjects(id,name,user_id) VALUES($1,'Carga isolada 2000 questões',$2)", [sid, config.ids.admin]);
    const options = JSON.stringify([{ key: "A", text: "Resposta incorreta" }, { key: "B", text: "Resposta correta" }]);
    await client.query("INSERT INTO questions(user_id,subject_id,statement,options,correct_key,feedback) SELECT $1,$2,'Qual alternativa da questão de carga '||n||' está correta?',$3::jsonb,'B','A alternativa B está correta.' FROM generate_series(1,2000) n", [config.ids.admin, sid, options]);
    const login = await fetch(config.baseUrl + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "student@aluno.univesp.br", password: config.password }) });
    if (!login.ok) throw new Error("Fixture login failed.");
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    const reports = [];
    for (const [route, requests, concurrency] of [["/api/dashboard", 60, 5], ["/api/subjects", 60, 5], ["/api/quiz", 15, 3]]) {
      let next = 0;
      const timings = [];
      let failures = 0;
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next++ < requests) {
          const start = performance.now();
          const response = await fetch(config.baseUrl + route, { method: route === "/api/quiz" ? "POST" : "GET", headers: { Cookie: cookie, "Content-Type": "application/json" }, ...(route === "/api/quiz" ? { body: JSON.stringify({ subjectId: sid, count: 20 }) } : {}), signal: AbortSignal.timeout(15000) });
          await response.arrayBuffer();
          timings.push(Math.round(performance.now() - start));
          if (!response.ok) failures++;
        }
      }));
      timings.sort((a, b) => a - b);
      reports.push({ route, requests: timings.length, concurrency, failures, p50Ms: timings[Math.floor(timings.length * 0.5)], p95Ms: timings[Math.floor(timings.length * 0.95)], maxMs: timings.at(-1) });
    }
    const plan = (await client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM questions WHERE subject_id=$1 AND archived_at IS NULL AND correct_key IS NOT NULL ORDER BY random() LIMIT 20", [sid])).rows;
    const storage = (await client.query("SELECT count(*)::int AS pdfs,coalesce(sum(octet_length(data)),0)::text AS bytes FROM material_files")).rows[0];
    const result = { testedAt: new Date().toISOString(), scope: "Local isolated PostgreSQL; 2000 questions. Not a production capacity guarantee.", reports, storage, randomSelectionPlan: plan };
    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/load-report.json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ reports, storage }));
    if (reports.some(row => row.failures > 0)) process.exitCode = 1;
  } finally { await client.end(); }
});
