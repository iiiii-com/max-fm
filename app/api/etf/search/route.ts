import { NextResponse } from "next/server";
import { fetchEtfSearch } from "@/lib/data/market";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ hits: [] });
  const hits = await fetchEtfSearch(q);
  return NextResponse.json({ hits });
}