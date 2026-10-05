import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "仪表盘" };

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardView userName={user.name} />;
}
