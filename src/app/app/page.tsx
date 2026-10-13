import Dashboard from "@/features/study/Dashboard";
import { requireUser } from "@/lib/auth";
import { readDashboard } from "@/server/repositories/dashboard";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await readDashboard(user.id);
  return <Dashboard initialAttempts={data.attempts} totalAttempts={data.totalAttempts} />;
}
