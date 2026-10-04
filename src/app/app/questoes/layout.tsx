import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function QuestionBankLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!user.isAdmin) redirect("/app");
  return children;
}
