import dotenv from "dotenv";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, stat, rm, rename } from "node:fs/promises";
import path from "node:path";
import { migrationDatabaseUrl } from "./database-url.mjs";
dotenv.config({ path: ".env.local", quiet: true });
const db = new URL(migrationDatabaseUrl());
const args = process.argv.slice(2);
const container = args.length === 1 ? args[0] : args[0] === "--container" && args.length === 2 ? args[1] : undefined;
if (args.length && (!container || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container))) throw new Error("Usage: npm run db:backup [-- <container-name>]");
const root = path.resolve("backups");
await mkdir(root, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const output = path.join(root, `aprova-${stamp}.dump`);
const temporary = output + ".partial";
let code;
if (container) {
  const execute = promisify(execFile);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(db.hostname)) throw new Error("Docker backup requires a local DATABASE_URL.");
  const inspected = JSON.parse((await execute("docker", ["inspect", container])).stdout)[0];
  const ports = inspected.NetworkSettings.Ports["5432/tcp"] ?? [];
  if (!inspected.State.Running || !ports.some((p) => p.HostPort === (db.port || "5432"))) throw new Error("Container port does not match DATABASE_URL.");
  const inside = `/tmp/aprova-${stamp}.dump`;
  try {
    await execute("docker", ["exec", container, "pg_dump", "-U", decodeURIComponent(db.username), "-d", decodeURIComponent(db.pathname.slice(1)), "--format=custom", "--no-owner", "--no-acl", "--file", inside]);
    await execute("docker", ["exec", container, "pg_restore", "--list", inside]);
    await execute("docker", ["cp", `${container}:${inside}`, temporary]);
    code = 0;
  } catch { code = 1; }
} else {
const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", temporary], {
  env: { ...process.env, PGHOST: db.hostname, PGPORT: db.port || "5432", PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password), PGDATABASE: decodeURIComponent(db.pathname.slice(1)) },
  stdio: ["ignore", "ignore", "inherit"],
});
code = await new Promise(resolve => { child.on("error", () => resolve(-1)); child.on("exit", resolve); });
}
if (code !== 0) {
  await rm(temporary, { force: true });
  console.error("Backup failed. Check DATABASE_URL and PostgreSQL client tools, or use --container with a matching local PostgreSQL container.");
  process.exitCode = 1;
} else {
  if (!(await stat(temporary)).size) throw new Error("Backup is empty; previous backups were retained.");
  await rename(temporary, output);
  const cutoff = Date.now() - 30 * 86400000;
  for (const name of await readdir(root)) {
    if (!/^aprova-\d{8}T\d{6}Z\.dump$/.test(name)) continue;
    const target = path.resolve(root, name);
    if (path.dirname(target) !== root) throw new Error("Backup path outside target directory.");
    if ((await stat(target)).mtimeMs < cutoff) await rm(target);
  }
  console.log(`Backup saved: ${output}`);
}
