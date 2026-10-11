import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canStudy } from "@/lib/access";
import AccessPending from "@/components/AccessPending";

export const metadata = { title: "Seu acesso — Aprova UNIVESP", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function PendingPage({ searchParams }: { searchParams: Promise<{ envio?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (canStudy(user)) redirect("/app");
  const params = await searchParams;
  return <AccessPending user={user} emailFailed={params.envio === "pendente"} />;
}
