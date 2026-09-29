import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, requireUser, safeUser, verifyPassword } from "@/lib/auth";
import { ApiError, handleError, str } from "@/lib/errors";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = str(body?.name, 80);
    const course = str(body?.course, 120);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    if (name.length < 2 || course.length < 2) throw new ApiError(400, "Nome e curso são obrigatórios.");
    const values: { name: string; course: string; passwordHash?: string } = { name, course };
    if (newPassword) {
      if (newPassword.length < 8) throw new ApiError(400, "A nova senha precisa ter pelo menos 8 caracteres.");
      const record = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
      if (!record || !currentPassword || !(await verifyPassword(currentPassword, record.passwordHash)))
        throw new ApiError(400, "Informe sua senha atual corretamente.");
      values.passwordHash = await hashPassword(newPassword);
    }
    const rows = await db.update(users).set(values).where(eq(users.id, user.id)).returning();
    return Response.json({ user: safeUser(rows[0]) });
  } catch (e) { return handleError(e); }
}
