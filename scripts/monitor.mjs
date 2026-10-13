const raw = process.env.MONITOR_URL ?? process.env.APP_URL;
if (!raw) throw new Error("Configure MONITOR_URL or APP_URL.");
const url = new URL("/api/health", raw);
if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Remote monitoring requires HTTPS.");
const started = performance.now();
let healthy = false;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
  const body = await response.json();
  healthy = response.ok && body.ok === true;
  console.log(JSON.stringify({ event: healthy ? "monitor.ok" : "monitor.failed", status: response.status, durationMs: Math.round(performance.now() - started) }));
} catch { console.error(JSON.stringify({ event: "monitor.unreachable", durationMs: Math.round(performance.now() - started) })); }
if (!healthy) process.exitCode = 1;
