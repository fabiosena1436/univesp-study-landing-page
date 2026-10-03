import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const config = JSON.parse(await readFile(".test-env.json", "utf8"));
const child = spawn(process.execPath, ["--import", "./scripts/test-email-mock.mjs", "node_modules/next/dist/bin/next", "start", "-p", "3100"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: config.databaseUrl, APP_URL: config.baseUrl, TZ: "UTC", GEMINI_API_KEY: "", RESEND_API_KEY: "test-only-fake-key", RESEND_FROM_EMAIL: "Test <test@example.invalid>" },
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 1; });
