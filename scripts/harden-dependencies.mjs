import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
// GHSA-vfj7-8cjw-p6xm: upstream latest is still 3.0.3. Limit AST nesting
// before recursive compilation/stringification. Keep this explicit backport
// until an upstream release provides the fix; npm audit still reports it.
const metadata = require("braces/package.json");
if (metadata.version === "3.0.3") {
  const file = path.join(path.dirname(require.resolve("braces/package.json")), "lib", "parse.js");
  const source = await readFile(file, "utf8");
  const marker = "// Aprova UNIVESP: bound parser nesting (GHSA-vfj7-8cjw-p6xm)";
  if (!source.includes(marker)) {
    const anchor = "  while (index < length) {";
    if (source.split(anchor).length !== 2) throw new Error("Unexpected braces parser; review the security backport.");
    await writeFile(file, source.replace(anchor, `${anchor}\n    ${marker}\n    if (stack.length > 100) throw new RangeError('Brace pattern nesting exceeds 100 levels');`));
  }
}
