export function migrationDatabaseUrl(env = process.env) {
  const value = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!value) throw new Error("Configure DATABASE_URL_UNPOOLED or DATABASE_URL.");
  const url = new URL(value);
  if (url.hostname.includes("-pooler.") && url.hostname.endsWith(".neon.tech")) throw new Error("Configure DATABASE_URL_UNPOOLED with the direct Neon connection for migrations and backups.");
  return value;
}
