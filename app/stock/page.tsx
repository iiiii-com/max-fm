import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StockRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(q ? `/market?tab=stocks&q=${encodeURIComponent(q)}` : "/market?tab=stocks");
}