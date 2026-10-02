import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions, admins } from "@/db/schema";
import { ApiError } from "./errors";
import type { User } from "./types";

const COOKIE = "repete_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function safeUser(u: {
  id: string;
  name: string;
  email: string;
  course: string | null;
  createdAt: Date | string;
  isAdmin?: boolean;
}): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    course: u.course,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    ...(u.isAdmin === undefined ? {} : { isAdmin: u.isAdmin }),
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.insert(sessions).values({ userId, token: hashSession(token), expiresAt });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, hashSession(token)));
    } catch {
      // sessão já pode não existir; ignorar
    }
  }
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, hashSession(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    try {
      await db.delete(sessions).where(eq(sessions.token, hashSession(token)));
    } catch {
      // ignore
    }
    return null;
  }
  const admin = await db.select({ userId: admins.userId }).from(admins).where(eq(admins.userId, row.user.id)).limit(1);
  if (!row.user.emailVerifiedAt || row.user.isBlocked) return null;
  return safeUser({ ...row.user, isAdmin: Boolean(admin[0]) });
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ApiError(403, "Acesso restrito ao administrador.");
  return { ...user, isAdmin: true };
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Você precisa estar logado para acessar isso.");
  return user;
}

export function hashSession(token: string) { return createHash("sha256").update(token).digest("hex"); }
