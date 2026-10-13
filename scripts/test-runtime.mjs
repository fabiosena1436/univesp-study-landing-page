import { spawn, spawnSync } from "node:child_process";
import { readFile, mkdir, appendFile } from "node:fs/promises";
export async function withTestRuntime(work) {
  const config = JSON.parse(await readFile(".test-env.json", "utf8"));
  const url = new URL(config.baseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !new URL(config.databaseUrl).pathname.startsWith("/aprova_test")) throw new Error("This check only runs against local isolated fixtures.");
  let occupied = false;
  try { await fetch(config.baseUrl + "/api/health", { signal: AbortSignal.timeout(1000) }); occupied = true; } catch {}
  if (occupied) throw new Error("The test port is in use. Stop the previous test server first.");
  await mkdir("artifacts", { recursive: true });
  const server = spawn(process.execPath, ["scripts/test-server.mjs"], { detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
  let exited = false;
  server.on("exit", () => { exited = true; });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", bytes => { void appendFile("artifacts/test-runtime.log", bytes).catch(() => {}); });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (exited) throw new Error("Test server stopped; inspect artifacts/test-runtime.log.");
      try { const r = await fetch(config.baseUrl + "/api/health", { signal: AbortSignal.timeout(2000) }); if (r.ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Test server did not become ready.");
    return await work(config);
  } finally {
    if (process.platform === "win32" && server.pid) spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    else if (server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch {} }
  }
}
