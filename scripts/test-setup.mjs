import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { applyMigrations } from "./migrate.mjs";

const source = process.env.TEST_DATABASE_URL ?? "postgresql://app:app@127.0.0.1:55439/aprova_test";
const base = new URL(source);
if (!/^\/?aprova_test/.test(base.pathname)) throw new Error("TEST_DATABASE_URL must point to a database named aprova_test*; never use the application database.");
const control = new pg.Client({ connectionString: base.href, connectionTimeoutMillis: 5000 });
const dbName = "aprova_test_" + Date.now();
await control.connect(); await control.query(`CREATE DATABASE "${dbName}"`); await control.end();
base.pathname = "/" + dbName;
const client = new pg.Client({ connectionString: base.href });
try {
  await client.connect();
  // Exercise upgrading a populated legacy database, not just an empty schema.
  await client.query(await readFile("migrations/0000_initial.sql", "utf8"));
  const hash = await bcrypt.hash("TestingOnly123!", 10);
  const ids = { admin: randomUUID(), student: randomUUID(), pending: randomUUID(), subject: randomUUID(), question: randomUUID() };
  for (const [role, id] of Object.entries(ids).filter(([key]) => ["admin", "student", "pending"].includes(key))) {
    await client.query("INSERT INTO users(id,name,email,course,password_hash) VALUES($1,$2,$3,'Computação',$4)", [id, "Teste " + role, role + "@aluno.univesp.br", hash]);
  }
  await client.query("INSERT INTO admins(user_id) VALUES($1)", [ids.admin]);
  await client.query("INSERT INTO subjects(id,user_id,name) VALUES($1,$2,'Matéria de teste')", [ids.subject, ids.admin]);
  const options = [{ key: "A", text: "Resposta incorreta" }, { key: "B", text: "Resposta correta" }];
  await client.query("INSERT INTO questions(id,user_id,subject_id,statement,options,correct_key,feedback) VALUES($1,$2,$3,'Qual alternativa está correta?', $4, 'B', 'A resposta correta é B.')", [ids.question, ids.admin, ids.subject, JSON.stringify(options)]);
  const attempt = (await client.query("INSERT INTO attempts(user_id,subject_id,total,correct_count) VALUES($1,$2,1,1) RETURNING id", [ids.student, ids.subject])).rows[0];
  await client.query("INSERT INTO attempt_answers(attempt_id,question_id,selected_key,is_correct) VALUES($1,$2,'B',true)", [attempt.id, ids.question]);
  for (let i = 0; i < 2; i++) await client.query("INSERT INTO study_progress(user_id,question_id,repetitions,correct_count) VALUES($1,$2,1,1)", [ids.student, ids.question]);
  await applyMigrations(client, { adoptLegacy: true });
  await applyMigrations(client); // Check repeat runs.
  await client.query("UPDATE users SET email_verified_at=now() WHERE id=$1", [ids.student]);
  await writeFile(".test-env.json", JSON.stringify({ databaseUrl: base.href, baseUrl: "http://localhost:3100", ids, legacyAttemptId: attempt.id, password: "TestingOnly123!" }));
  console.log("Isolated database prepared; legacy history and duplicate progress migrated.");
} finally { await client.end(); }
