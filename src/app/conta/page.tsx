import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canStudy } from "@/lib/access";
import { AccountSettings } from "@/features/account/AccountSettings";
export const metadata = { title: "Minha conta — Aprova UNIVESP", robots: { index: false, follow: false } };
export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return <main className="mx-auto max-w-3xl px-4 py-8"><Link className="mb-6 inline-block text-pen underline" href={canStudy(user) ? "/app" : "/aguardando-aprovacao"}>Voltar</Link><AccountSettings initialUser={user} /></main>;
}
