import { NextResponse } from "next/server";
import { fetchQuotes, fetchGlobalQuotes, fetchSectors } from "@/lib/data/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const [quotes, global, sectors] = await Promise.all([fetchQuotes(), fetchGlobalQuotes(), fetchSectors()]);
  return NextResponse.json({ quotes, global, sectors, time: Date.now() });
}
