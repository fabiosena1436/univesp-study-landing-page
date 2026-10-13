"use client";
import { useApp } from "@/components/AppShell";
import { AccountSettings } from "@/features/account/AccountSettings";
export default function ProfilePage() {
  const { user, updateUser } = useApp();
  return <AccountSettings initialUser={user} onUpdated={updateUser} />;
}
