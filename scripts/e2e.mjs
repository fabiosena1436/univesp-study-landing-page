import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile(".test-env.json", "utf8"));
const server = spawn(process.execPath, ["scripts/test-server.mjs"], { stdio: "inherit" });
let ready = false;
try {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(config.baseUrl + "/api/health"); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Test server did not become healthy.");
  const test = spawn(process.execPath, ["--test", "tests/integration/flows.test.mjs"], { stdio: "inherit" });
  process.exitCode = await new Promise(resolve => test.on("exit", code => resolve(code ?? 1)));
} finally { server.kill("SIGTERM"); }
