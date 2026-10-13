import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json", "--cache", "artifacts/npm-cache"], {
  encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
  env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? (process.platform === "win32" ? "1" : undefined) },
});
if (result.error) throw result.error;
let audit;
try { audit = JSON.parse(result.stdout.replace(/^\uFEFF/, "")); } catch { throw new Error("Security registry could not be audited. Do not treat a network failure as a clean audit."); }
if (!audit.metadata || audit.error) throw new Error("Security audit unavailable.");
const knownChain = new Set(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"]);
const patched = readFileSync(path.join(path.dirname(require.resolve("braces/package.json")), "lib/parse.js"), "utf8").includes("if (stack.length > 100) throw new RangeError");
const exceptions = [];
const failed = [];
for (const item of Object.values(audit.vulnerabilities ?? {})) {
  if (!["high", "critical"].includes(item.severity)) continue;
  const onlyKnown = knownChain.has(item.name) && patched && item.via.every(v => typeof v === "string" ? knownChain.has(v) : v.url === "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm");
  if (onlyKnown) exceptions.push(item.name); else failed.push(item.name);
}
console.log(JSON.stringify({ vulnerabilities: audit.metadata.vulnerabilities, locallyMitigatedBracesChain: exceptions, unmitigatedHighOrCritical: failed }));
if (failed.length) process.exitCode = 1;
