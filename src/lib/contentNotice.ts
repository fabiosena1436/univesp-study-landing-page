import { announcements } from "@/db/schema";
import { db } from "@/db";

// Publish in the content transaction: failed uploads/imports never send notices.
export async function contentNotice(tx: Pick<typeof db, "insert">, authorId: string, title: string, body: string) {
  await tx.insert(announcements).values({ authorId, title, body });
}
