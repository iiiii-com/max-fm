import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "ETF 专区" };

export default function EtfRedirect() {
  redirect("/market?tab=etf");
}