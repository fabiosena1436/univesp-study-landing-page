import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { applyMigrations } from "./migrate.mjs";

const execute = promisify(execFile);
const file = process.argv[2];
if (!file || process.argv.length !== 3) throw new Error("Usage: npm run db:restore:verify -- backups/<file>.dump");
const root = path.resolve("backups");
const source = path.resolve(file);
if (path.dirname(source) !== root || !source.endsWith(".dump") || !(await stat(source)).isFile()) throw new Error("Choose a .dump file inside the project backups directory.");
// This operation is intentionally restricted to the disposable local test service.
const container = "aprova-quality-postgres-1";
const inspected = JSON.parse((await execute("docker", ["inspect", container])).stdout)[0];
const ports = inspected.NetworkSettings.Ports["5432/tcp"] ?? [];
if (!inspected.State.Running || !ports.some((p) => p.HostIp === "127.0.0.1" && p.HostPort === "55439")) throw new Error("Start the isolated aprova-quality test database on 127.0.0.1:55439 first.");
const database = "aprova_test_restore_" + Date.now();
const containerFile = "/tmp/" + database + ".dump";
const admin = new pg.Client({ connectionString: "postgresql://app:app@127.0.0.1:55439/aprova_test", connectionTimeoutMillis: 5000 });
let restored;
try {
  await admin.connect();
  // The generated identifier contains only a fixed prefix and decimal digits.
  await admin.query(`CREATE DATABASE "${database}"`);
  await execute("docker", ["cp", source, `${container}:${containerFile}`]);
  await execute("docker", ["exec", container, "pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "-U", "app", "-d", database, containerFile]);
  restored = new pg.Client({ connectionString: `postgresql://app:app@127.0.0.1:55439/${database}`, connectionTimeoutMillis: 5000 });
  await restored.connect();
  const tables = ["users", "subjects", "materials", "questions", "attempts", "attempt_answers", "sessions", "support_tickets", "support_messages"];
  async function counts() {
    const result = {};
    for (const table of tables) result[table] = (await restored.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
    return result;
  }
  const before = await counts();
  const progressBefore = (await restored.query("SELECT coalesce(sum(correct_count),0)::text AS correct, coalesce(sum(wrong_count),0)::text AS wrong FROM study_progress")).rows[0];
  await applyMigrations(restored, { adoptLegacy: true });
  const after = await counts();
  const progressAfter = (await restored.query("SELECT coalesce(sum(correct_count),0)::text AS correct, coalesce(sum(wrong_count),0)::text AS wrong FROM study_progress")).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after) || JSON.stringify(progressBefore) !== JSON.stringify(progressAfter)) throw new Error("Migration changed restored record counts or progress totals.");
  const invalid = (await restored.query("SELECT count(*)::int AS n FROM attempt_answers WHERE snapshot IS NULL OR position IS NULL")).rows[0].n;
  if (invalid) throw new Error("Historical answer snapshots were not filled.");
  console.log(JSON.stringify({ restored: true, migrated: true, recordCountsPreserved: true, progressTotalsPreserved: true, historicalSnapshotsPresent: true, isolatedDatabase: database }));
  console.log("The isolated copy is retained for inspection; the main database was not modified. It contains personal data: keep the test service private.");
} finally {
  if (restored) await restored.end();
  await admin.end();
}
