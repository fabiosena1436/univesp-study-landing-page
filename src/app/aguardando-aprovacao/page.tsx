import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canStudy } from "@/lib/access";
import AccessPending from "@/components/AccessPending";

export const metadata = { title: "Seu acesso — Aprova UNIVESP", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PendingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (canStudy(user)) redirect("/app");
  return <AccessPending user={user} />;
}
