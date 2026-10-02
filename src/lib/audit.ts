import { auditEvents } from "@/db/schema";
import { db } from "@/db";

export async function audit(actorId: string, action: string, targetId: string, tx: Pick<typeof db, "insert"> = db) {
  await tx.insert(auditEvents).values({ actorId, action, targetId });
}
