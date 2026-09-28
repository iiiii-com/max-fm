import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "投资分析" };

export default function InvestRedirect() {
  redirect("/market");
}