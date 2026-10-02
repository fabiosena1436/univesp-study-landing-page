import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, passwordResetTokens } from "@/db/schema";
import { createSession, hashPassword, requireUser, safeUser, verifyPassword } from "@/lib/auth";
import { passwordError } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { ApiError, handleError, str } from "@/lib/errors";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    await rateLimit("profile", user.id, 10, 60000);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 80);
    const course = str(body?.course, 120);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (name.length < 2 || course.length < 2) throw new ApiError(400, "Nome e curso são obrigatórios.");
    const values: { name: string; course: string; passwordHash?: string } = { name, course };
    if (newPassword) {
      const invalid = passwordError(newPassword);
      if (invalid) throw new ApiError(400, invalid);
      values.passwordHash = await hashPassword(newPassword);
    }
    const rows = await db.transaction(async (tx) => {
      const record = (await tx.select().from(users).where(eq(users.id, user.id)).limit(1).for("update"))[0];
      if (!record) throw new ApiError(404, "Conta não encontrada.");
      if (newPassword && (!currentPassword || Buffer.byteLength(currentPassword, "utf8") > 72 || !(await verifyPassword(currentPassword, record.passwordHash)))) throw new ApiError(400, "Informe sua senha atual corretamente.");
      const result = await tx.update(users).set(values).where(eq(users.id, user.id)).returning();
      if (newPassword) {
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.userId, user.id));
      }
      return result;
    });
    if (newPassword) await createSession(user.id);
    return Response.json({ user: safeUser(rows[0]) });
  } catch (e) { return handleError(e); }
}
