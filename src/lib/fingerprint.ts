import { createHash } from "node:crypto";
import type { OptionT } from "./types";
export function questionFingerprint(statement: string, options: OptionT[], correctKey: string | null) {
  return createHash("sha256").update(JSON.stringify([
    statement.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim(),
    [...options].sort((a, b) => a.key.localeCompare(b.key)), correctKey,
  ])).digest("hex");
}
