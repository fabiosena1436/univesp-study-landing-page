import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { ApiError } from "./errors";

function key() {
  const value = process.env.MFA_ENCRYPTION_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new ApiError(503, "A autenticação em duas etapas ainda precisa ser configurada no servidor.");
  return Buffer.from(value, "hex");
}
export function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function decryptMfaSecret(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new ApiError(503, "Não foi possível ler a configuração de segurança.");
  const [iv, tag, data] = parts.map(part => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export function mfaTotp(secret: string, email: string) {
  return new TOTP({ issuer: "Aprova UNIVESP", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
}
export function newMfaSecret() { return new Secret({ size: 20 }).base32; }
export function recoveryHash(code: string) { return createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex"); }
export function newRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(10).toString("hex").match(/.{1,5}/g)!.join("-"));
}
export function validateMfa(record: { email: string; mfaSecret: string | null; mfaLastUsedStep: number | null; mfaRecoveryHashes: string[] }, code: string, timestamp = Date.now()) {
  if (!record.mfaSecret) return null;
  if (/^\d{6}$/.test(code)) {
    const totp = mfaTotp(decryptMfaSecret(record.mfaSecret), record.email);
    const delta = totp.validate({ token: code, timestamp, window: 1 });
    const step = Math.floor(timestamp / 30000) + (delta ?? 0);
    return delta !== null && step > (record.mfaLastUsedStep ?? -1) ? { mfaLastUsedStep: step } : null;
  }
  if (!/^[a-f0-9\s-]{20,30}$/i.test(code)) return null;
  const hash = recoveryHash(code);
  const found = record.mfaRecoveryHashes.find(saved => saved.length === hash.length && timingSafeEqual(Buffer.from(saved, "hex"), Buffer.from(hash, "hex")));
  return found ? { mfaRecoveryHashes: record.mfaRecoveryHashes.filter(saved => saved !== found) } : null;
}
