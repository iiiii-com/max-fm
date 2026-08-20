import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "周期洞察 · 康波周期" };

export default function CyclePage() {
  redirect("/history?tab=waves");
}