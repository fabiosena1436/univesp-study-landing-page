import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { robots: { index: false, follow: false } };

export default async function AppAreaLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return <AppShell initialUser={user}>{children}</AppShell>;
}
